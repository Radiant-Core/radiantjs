#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Reference Python implementation of Radiant's ForkId SignatureHash algorithm.

This is a deliberately small, self-contained, stdlib-only re-implementation of
the C++ algorithm in Radiant-Core/src/script/interpreter.cpp::SignatureHash
(FORKID branch, lines ~2634-2695) plus the Radiant-specific
GetHashOutputHashes helper in Radiant-Core/src/primitives/transaction.h
(lines 440-541).

It exists to produce byte-exact cross-validation fixtures for the JavaScript
implementation in radiantjs/lib/transaction/sighash.js. If the JS impl ever
diverges from the C++ algorithm in a way that is still internally consistent,
these fixtures will catch it.

Limitations
-----------
- Only handles vanilla scripts (no OP_PUSHINPUTREF / OP_REQUIRE_REF /
  OP_DISALLOWPUSHINPUTREF / OP_SINGLETON push-ref opcodes). For such scripts,
  the C++ branch emits totalRefs=0 and refsHash=32 zero bytes per output. This
  is sufficient to cross-validate normal P2PKH payments.
- Caller passes pre-built scripts as raw hex bytes.

When run as __main__ this script writes 8 test vectors to
sighash_radiant.json in the same directory.
"""

import hashlib
import json
import os
import struct


# ---------------------------------------------------------------------------
# Sighash type constants (must match crypto/signature.js and C++ sighashtype.h)
# ---------------------------------------------------------------------------
SIGHASH_ALL = 0x01
SIGHASH_NONE = 0x02
SIGHASH_SINGLE = 0x03
SIGHASH_FORKID = 0x40
SIGHASH_ANYONECANPAY = 0x80


# ---------------------------------------------------------------------------
# Hash helpers. CHashWriter.GetHash() in Radiant-Core is double-SHA256
# (CHash256). The JS impl uses Hash.sha256sha256 in the matching spots, so we
# do the same here.
# ---------------------------------------------------------------------------
def sha256(b):
    return hashlib.sha256(b).digest()


def sha256d(b):
    return hashlib.sha256(hashlib.sha256(b).digest()).digest()


# ---------------------------------------------------------------------------
# BIP varint (CompactSize).
# ---------------------------------------------------------------------------
def compact_size(n):
    if n < 0xfd:
        return bytes([n])
    if n <= 0xffff:
        return b'\xfd' + struct.pack('<H', n)
    if n <= 0xffffffff:
        return b'\xfe' + struct.pack('<I', n)
    return b'\xff' + struct.pack('<Q', n)


# ---------------------------------------------------------------------------
# Serialization primitives for outpoints / inputs / outputs / tx.
# ---------------------------------------------------------------------------
def serialize_outpoint(txid_hex, vout):
    # txid is stored internally big-endian as displayed; on-wire is reversed.
    return bytes.fromhex(txid_hex)[::-1] + struct.pack('<I', vout)


def serialize_input(inp):
    script = bytes.fromhex(inp.get('scriptSig', ''))
    return (
        serialize_outpoint(inp['txid'], inp['vout'])
        + compact_size(len(script))
        + script
        + struct.pack('<I', inp['sequence'])
    )


def serialize_output(out):
    script = bytes.fromhex(out['scriptPubKey'])
    return (
        struct.pack('<q', out['value'])
        + compact_size(len(script))
        + script
    )


def serialize_tx(tx):
    """Serialize a tx_dict to its standard on-wire form (no segwit)."""
    out = struct.pack('<i', tx['version'])
    out += compact_size(len(tx['inputs']))
    for inp in tx['inputs']:
        out += serialize_input(inp)
    out += compact_size(len(tx['outputs']))
    for o in tx['outputs']:
        out += serialize_output(o)
    out += struct.pack('<I', tx['nLockTime'])
    return out


# ---------------------------------------------------------------------------
# Sub-hashes from interpreter.cpp lines 2593-2615.
# ---------------------------------------------------------------------------
def get_prevout_hash(tx):
    buf = b''.join(serialize_outpoint(i['txid'], i['vout']) for i in tx['inputs'])
    return sha256d(buf)


def get_sequence_hash(tx):
    buf = b''.join(struct.pack('<I', i['sequence']) for i in tx['inputs'])
    return sha256d(buf)


def get_outputs_hash(tx, only_index=None):
    if only_index is None:
        buf = b''.join(serialize_output(o) for o in tx['outputs'])
    else:
        buf = serialize_output(tx['outputs'][only_index])
    return sha256d(buf)


# ---------------------------------------------------------------------------
# Radiant-specific hashOutputHashes (transaction.h:476 / :533).
#
# For each output, write:
#   nValue           (8 bytes, int64 LE)
#   scriptPubKeyHash (32 bytes, sha256d of scriptPubKey via CHashWriter)
#   totalRefs        (4 bytes, uint32 LE; 0 for vanilla scripts)
#   refsHash         (32 bytes, all-zero for totalRefs=0)
# Then sha256d the whole concatenation via CHashWriter.GetHash().
# ---------------------------------------------------------------------------
ZERO_REF = b'\x00' * 32


def _output_summary_bytes(out):
    script = bytes.fromhex(out['scriptPubKey'])
    # CHashWriter << CFlatData(script) hashes the raw script bytes (no length
    # prefix) and finalizes to a double-SHA256.
    script_hash = sha256d(script)
    # Vanilla script path: no push refs. totalRefs=0, refsHash=zeros.
    return (
        struct.pack('<q', out['value'])
        + script_hash
        + struct.pack('<I', 0)
        + ZERO_REF
    )


def get_hash_output_hashes(tx, only_index=None):
    if only_index is None:
        buf = b''.join(_output_summary_bytes(o) for o in tx['outputs'])
    else:
        buf = _output_summary_bytes(tx['outputs'][only_index])
    return sha256d(buf)


# ---------------------------------------------------------------------------
# The main entry point: SignatureHash (FORKID branch).
#
# Returns the on-wire (big-endian / canonical) 32-byte digest. The JS
# Sighash.sighash() returns the *reversed* (little-endian) form; the test
# harness is responsible for that reversal before comparing.
# ---------------------------------------------------------------------------
def signature_hash_forkid(tx, n_in, scriptcode_bytes, amount, sighash_type):
    assert n_in < len(tx['inputs'])
    assert sighash_type & SIGHASH_FORKID, 'must be a ForkId sighash'

    base = sighash_type & 0x1f
    anyone = bool(sighash_type & SIGHASH_ANYONECANPAY)

    hash_prevouts = b'\x00' * 32
    hash_sequence = b'\x00' * 32
    hash_outputs = b'\x00' * 32
    hash_output_hashes = b'\x00' * 32

    if not anyone:
        hash_prevouts = get_prevout_hash(tx)

    if not anyone and base != SIGHASH_SINGLE and base != SIGHASH_NONE:
        hash_sequence = get_sequence_hash(tx)

    if base != SIGHASH_SINGLE and base != SIGHASH_NONE:
        hash_outputs = get_outputs_hash(tx)
        hash_output_hashes = get_hash_output_hashes(tx)
    elif base == SIGHASH_SINGLE and n_in < len(tx['outputs']):
        hash_outputs = get_outputs_hash(tx, only_index=n_in)
        hash_output_hashes = get_hash_output_hashes(tx, only_index=n_in)
    # else: both stay zero (the Radiant fix for the SIGHASH_SINGLE bug -
    # the legacy code returned uint256(1); FORKID returns sha256d of the
    # zero-padded preimage instead).

    inp = tx['inputs'][n_in]
    preimage = (
        struct.pack('<i', tx['version'])
        + hash_prevouts
        + hash_sequence
        + serialize_outpoint(inp['txid'], inp['vout'])
        + compact_size(len(scriptcode_bytes)) + scriptcode_bytes
        + struct.pack('<q', amount)
        + struct.pack('<I', inp['sequence'])
        + hash_output_hashes
        + hash_outputs
        + struct.pack('<I', tx['nLockTime'])
        + struct.pack('<I', sighash_type & 0xffffffff)
    )
    return sha256d(preimage)


# ---------------------------------------------------------------------------
# Fixture generation.
# ---------------------------------------------------------------------------
def _p2pkh(hash160_hex):
    """Return raw scriptPubKey hex for OP_DUP OP_HASH160 <h160> OP_EQUALVERIFY OP_CHECKSIG."""
    h = bytes.fromhex(hash160_hex)
    assert len(h) == 20
    return (b'\x76\xa9\x14' + h + b'\x88\xac').hex()


def main():
    # Deterministic stand-in hash160s (recognizable).
    h160_a = '11' * 20
    h160_b = '22' * 20
    h160_c = '33' * 20

    txid_a = 'aa' * 32
    txid_b = 'bb' * 32

    pk_a = _p2pkh(h160_a)
    pk_b = _p2pkh(h160_b)
    pk_c = _p2pkh(h160_c)

    # Common "spent UTXO" scriptCode for P2PKH (matches pk_a).
    scriptcode_a = pk_a
    scriptcode_b = pk_b

    FORKID = SIGHASH_FORKID
    ALL = SIGHASH_ALL | FORKID
    NONE = SIGHASH_NONE | FORKID
    SINGLE = SIGHASH_SINGLE | FORKID
    ALL_ACP = SIGHASH_ALL | FORKID | SIGHASH_ANYONECANPAY

    def make_tx(inputs, outputs, version=1, locktime=0):
        return {
            'version': version,
            'inputs': inputs,
            'outputs': outputs,
            'nLockTime': locktime,
        }

    in_a0 = {'txid': txid_a, 'vout': 0, 'scriptSig': '', 'sequence': 0xffffffff}
    in_b1 = {'txid': txid_b, 'vout': 1, 'scriptSig': '', 'sequence': 0xfffffffe}

    out_b_1c = {'value': 100_000_000, 'scriptPubKey': pk_b}      # 1 RXD
    out_c_change = {'value': 50_000_000, 'scriptPubKey': pk_c}   # 0.5 RXD change
    out_b_5c = {'value': 500_000_000, 'scriptPubKey': pk_b}
    out_huge = {'value': 10 ** 18, 'scriptPubKey': pk_b}         # > 2^53

    vectors = []

    # 1. SIGHASH_ALL | FORKID on 1-in / 1-out P2PKH
    tx1 = make_tx([in_a0], [out_b_1c])
    h1 = signature_hash_forkid(tx1, 0, bytes.fromhex(scriptcode_a),
                               1_000_000_000, ALL)
    vectors.append([
        serialize_tx(tx1).hex(), scriptcode_a, 0, ALL, h1.hex(),
        str(1_000_000_000),
        '1-in/1-out P2PKH, SIGHASH_ALL|FORKID',
    ])

    # 2. SIGHASH_ALL | FORKID on 1-in / 2-out P2PKH (with change)
    tx2 = make_tx([in_a0], [out_b_1c, out_c_change])
    h2 = signature_hash_forkid(tx2, 0, bytes.fromhex(scriptcode_a),
                               1_000_000_000, ALL)
    vectors.append([
        serialize_tx(tx2).hex(), scriptcode_a, 0, ALL, h2.hex(),
        str(1_000_000_000),
        '1-in/2-out P2PKH with change, SIGHASH_ALL|FORKID',
    ])

    # 3. SIGHASH_NONE | FORKID on 1-in / 2-out
    tx3 = make_tx([in_a0], [out_b_1c, out_c_change])
    h3 = signature_hash_forkid(tx3, 0, bytes.fromhex(scriptcode_a),
                               1_000_000_000, NONE)
    vectors.append([
        serialize_tx(tx3).hex(), scriptcode_a, 0, NONE, h3.hex(),
        str(1_000_000_000),
        '1-in/2-out, SIGHASH_NONE|FORKID',
    ])

    # 4. SIGHASH_SINGLE | FORKID, n_in < n_outputs (in-range)
    tx4 = make_tx([in_a0], [out_b_1c, out_c_change])
    h4 = signature_hash_forkid(tx4, 0, bytes.fromhex(scriptcode_a),
                               1_000_000_000, SINGLE)
    vectors.append([
        serialize_tx(tx4).hex(), scriptcode_a, 0, SINGLE, h4.hex(),
        str(1_000_000_000),
        '1-in/2-out, SIGHASH_SINGLE|FORKID in-range (input 0, output 0)',
    ])

    # 5. SIGHASH_SINGLE | FORKID, n_in >= n_outputs (out-of-range).
    # 2 inputs, 1 output, sign input index 1. Per the FORKID branch, both
    # hash_outputs and hash_output_hashes stay all-zero (NOT uint256(1)).
    tx5 = make_tx([in_a0, in_b1], [out_b_1c])
    h5 = signature_hash_forkid(tx5, 1, bytes.fromhex(scriptcode_b),
                               2_000_000_000, SINGLE)
    vectors.append([
        serialize_tx(tx5).hex(), scriptcode_b, 1, SINGLE, h5.hex(),
        str(2_000_000_000),
        '2-in/1-out, SIGHASH_SINGLE|FORKID out-of-range (input 1, no output 1)',
    ])

    # 6. SIGHASH_ALL | FORKID | ANYONECANPAY
    tx6 = make_tx([in_a0, in_b1], [out_b_1c, out_c_change])
    h6 = signature_hash_forkid(tx6, 1, bytes.fromhex(scriptcode_b),
                               750_000_000, ALL_ACP)
    vectors.append([
        serialize_tx(tx6).hex(), scriptcode_b, 1, ALL_ACP, h6.hex(),
        str(750_000_000),
        '2-in/2-out, SIGHASH_ALL|FORKID|ANYONECANPAY (input 1)',
    ])

    # 7. SIGHASH_ALL | FORKID with a large amount (10^18 > 2^53)
    tx7 = make_tx([in_a0], [out_huge])
    h7 = signature_hash_forkid(tx7, 0, bytes.fromhex(scriptcode_a),
                               10 ** 18, ALL)
    vectors.append([
        serialize_tx(tx7).hex(), scriptcode_a, 0, ALL, h7.hex(),
        str(10 ** 18),
        '1-in/1-out, SIGHASH_ALL|FORKID with 10^18 photon amount',
    ])

    # 8. SIGHASH_ALL | FORKID on 2-in / 2-out
    tx8 = make_tx([in_a0, in_b1], [out_b_5c, out_c_change])
    h8 = signature_hash_forkid(tx8, 0, bytes.fromhex(scriptcode_a),
                               1_000_000_000, ALL)
    vectors.append([
        serialize_tx(tx8).hex(), scriptcode_a, 0, ALL, h8.hex(),
        str(1_000_000_000),
        '2-in/2-out, SIGHASH_ALL|FORKID (input 0)',
    ])

    out_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                            'sighash_radiant.json')
    # File schema:
    #   [raw_tx_hex, scriptcode_hex, n_in, sighash_type_int,
    #    expected_sighash_hex_BIG_ENDIAN (on-wire / canonical),
    #    amount_satoshis_string,
    #    description]
    # The radiantjs Sighash.sighash() returns the *reversed* form, so the
    # mocha test reverses the expected hex before comparing.
    with open(out_path, 'w') as f:
        json.dump(vectors, f, indent=2)
    print('wrote %d vectors to %s' % (len(vectors), out_path))


if __name__ == '__main__':
    main()
