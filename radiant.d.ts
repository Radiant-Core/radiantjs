// Type definitions for radiantjs 1.7.4
// Project: https://github.com/radiantblockchain/radiantjs
// Forked From: https://github.com/moneybutton/bsv
// Forked From: https://github.com/bitpay/bitcore-lib
// Definitions by: Lautaro Dragan <https://github.com/lautarodragan>
// Definitions extended by: David Case <https://github.com/shruggr>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

// TypeScript Version: 2.2

/// <reference types="node" />

declare module '@radiantblockchain/radiantjs' {

    export namespace crypto {
        class BN { }

        namespace ECDSA {
            function sign(message: Buffer, key: PrivateKey): Signature;
            function verify(hashbuf: Buffer, sig: Signature, pubkey: PublicKey, endian?: 'little'): boolean;
        }

        namespace Hash {
            function sha1(buffer: Buffer): Buffer;
            function sha256(buffer: Buffer): Buffer;
            function sha256sha256(buffer: Buffer): Buffer;
            function sha256ripemd160(buffer: Buffer): Buffer;
            function sha512(buffer: Buffer): Buffer;
            function ripemd160(buffer: Buffer): Buffer;

            function sha256hmac(data: Buffer, key: Buffer): Buffer;
            function sha512hmac(data: Buffer, key: Buffer): Buffer;
        }

        namespace Random {
            function getRandomBuffer(size: number): Buffer;
        }

        namespace Point { }

        class Signature {
            static fromDER(sig: Buffer): Signature;
            static fromString(data: string): Signature;
            static SIGHASH_ALL: number;
            static SIGHASH_SINGLE: number;
            static SIGHASH_NONE: number;
            static SIGHASH_ANYONECANPAY: number;
            static SIGHASH_FORKID: number;
            toString(): string;
            toBuffer(): Buffer;
        }
    }

    export namespace Transaction {
        class UnspentOutput {
            static fromObject(o: object): UnspentOutput;

            readonly address: Address;
            readonly txId: string;
            readonly outputIndex: number;
            readonly script: Script;
            readonly satoshis: number;
            spentTxId: string | null;

            constructor(data: object);

            inspect(): string;
            toObject(): this;
            toString(): string;
        }

        class Output {
            readonly script: Script;
            readonly satoshis: number;
            readonly satoshisBN: crypto.BN;
            spentTxId: string | null;
            constructor(data: object);

            setScript(script: Script | string | Buffer): this;
            inspect(): string;
            toObject(): object;
        }

        class Input {
            constructor(object: any);
            readonly prevTxId: Buffer;
            readonly outputIndex: number;
            readonly sequenceNumber: number;
            readonly script: Script;
            output?: Output;
            isValidSignature(tx: Transaction, sig: any): boolean;
        }

        class Sighash {
            static sign(...args: any[]): crypto.Signature;
        }
    }

    export class Transaction {
        inputs: Transaction.Input[];
        outputs: Transaction.Output[];
        readonly id: string;
        readonly hash: string;
        readonly inputAmount: number;
        readonly outputAmount: number;
        nid: string;

        constructor(serialized?: any);

        from(utxos: Transaction.UnspentOutput | Transaction.UnspentOutput[] | object): this;
        to(address: Address[] | Address | string, amount: number): this;
        change(address: Address | string): this;
        fee(amount: number): this;
        feePerKb(amount: number): this;
        sign(privateKey: PrivateKey | string): this;
        seal(): this;
        applySignature(sig: crypto.Signature): this;
        addInput(input: Transaction.Input): this;
        addOutput(output: Transaction.Output): this;
        addData(value: Buffer | string): this;
        lockUntilDate(time: Date | number): this;
        lockUntilBlockHeight(height: number): this;

        hasWitnesses(): boolean;
        getFee(): number;
        getChangeOutput(): Transaction.Output | null;
        getLockTime(): Date | number;

        verify(): string | boolean;
        isCoinbase(): boolean;

        enableRBF(): this;
        isRBF(): boolean;

        inspect(): string;
        serialize(): string;

        toObject(): any;
        toBuffer(): Buffer;

        verify(): boolean | string;
        isFullySigned(): boolean;
    }

    export class ECIES {
        constructor(opts?: any, algorithm?: string);
        
        privateKey(privateKey: PrivateKey): ECIES;
        publicKey(publicKey: PublicKey): ECIES;
        encrypt(message: string | Buffer): Buffer;
        decrypt(encbuf: Buffer): Buffer;
    }
    export class Block {
        hash: string;
        height: number;
        transactions: Transaction[];
        header: {
            time: number;
            prevHash: string;
        };

        constructor(data: Buffer | object);
    }

    export class PrivateKey {
        constructor(key?: string, network?: Networks.Network);
        
        readonly publicKey: PublicKey;
        readonly compressed: boolean;
        readonly network: Networks.Network;
        
        toAddress(): Address;
        toPublicKey(): PublicKey;
        toString(): string;
        toObject(): object;
        toJSON(): object;
        toWIF(): string;
        toHex(): string;
        toBigNumber(): any; //BN;
        toBuffer(): Buffer;
        inspect(): string;

        static fromString(str: string): PrivateKey;
        static fromWIF(str: string): PrivateKey;
        static fromRandom(netowrk?: string): PrivateKey;
        static fromBuffer(buf: Buffer, network: string | Networks.Network): PrivateKey;
        static fromHex(hex: string, network: string | Networks.Network): PrivateKey;
        static getValidationError(data: string): any | null;
        static isValid(data: string): boolean;
    }

    export class PublicKey {
        constructor(source: string, extra?: object);
        
        //readonly point: Point;
        readonly compressed: boolean;
        readonly network: Networks.Network;

        toDER(): Buffer;
        toObject(): object;
        toBuffer(): Buffer;
        toAddress(network?: string | Networks.Network): Address;
        toString(): string;
        toHex(): string;
        inspect(): string;

        static fromPrivateKey(privateKey: PrivateKey): PublicKey;
        static fromBuffer(buf: Buffer, strict: boolean): PublicKey;
        static fromDER(buf: Buffer, strict: boolean): PublicKey;
        //static fromPoint(point: Point, compressed: boolean): PublicKey;
        //static fromX(odd: boolean, x: Point): PublicKey;
        static fromString(str: string): PublicKey;
        static fromHex(hex: string): PublicKey;
        static getValidationError(data: string): any | null;
        static isValid(data: string): boolean;
    }

    export class Message {
        constructor(message: string | Buffer);

        readonly messageBuffer: Buffer;

        sign(privateKey: PrivateKey): string;
        verify(address: string | Address, signature: string): boolean;
        toObject(): object;
        toJSON(): string;
        toString(): string;
        inspect(): string;

        static sign(message: string | Buffer, privateKey: PrivateKey): string;
        static verify(message: string | Buffer, address: string | Address, signature: string): boolean;
        static MAGIC_BYTES: Buffer;
        static magicHash(): string;
        static fromString(str: string): Message;
        static fromJSON(json: string): Message;
        static fromObject(obj: object): Message;
    }

    export class Mnemonic {
        constructor(data: string | Array<string>, wordList?: Array<string>);

        readonly wordList: Array<string>;
        readonly phrase: string;

        toSeed(passphrase?: string): Buffer;
        toHDPrivateKey(passphrase: string, network: string | number): HDPrivateKey;
        toString(): string;
        inspect(): string;

        static fromRandom(wordlist?: Array<string>): Mnemonic;
        static fromString(mnemonic: String, wordList?: Array<string>): Mnemonic;
        static isValid(mnemonic: String, wordList?: Array<string>): boolean;
        static fromSeed(seed: Buffer, wordlist: Array<string>): Mnemonic
    }

    export class HDPrivateKey {
        constructor(data?: string | Buffer | object);

        readonly hdPublicKey: HDPublicKey;
        
        readonly xprivkey: Buffer;
        readonly xpubkey: Buffer;
        readonly network: Networks.Network;
        readonly depth: number;
        readonly privateKey: PrivateKey;
        readonly publicKey: PublicKey;
        readonly fingerPrint: Buffer;

        derive(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPrivateKey;
        deriveNonCompliantChild(arg: string | number, hardened?: boolean): HDPrivateKey;

        toString(): string;
        toObject(): object;
        toJSON(): object;
        toBuffer(): Buffer;
        toHex(): string;
        inspect(): string;

        static fromRandom(): HDPrivateKey;
        static fromString(str: string): HDPrivateKey;
        static fromObject(obj: object): HDPrivateKey;
        static fromSeed(hexa: string | Buffer, network: string | Networks.Network): HDPrivateKey;
        static fromBuffer(buf: Buffer): HDPrivateKey;
        static fromHex(hex: string): HDPrivateKey;
        static isValidPath(arg: string | number, hardened: boolean): boolean;
        static isValidSerialized(data: string | Buffer, network?: string | Networks.Network): boolean;
        static getSerializedError(data: string | Buffer, network?: string | Networks.Network): any | null;
    }

    export class HDPublicKey {
        constructor(arg: string | Buffer | object);

        readonly xpubkey: Buffer;
        readonly network: Networks.Network;
        readonly depth: number;
        readonly publicKey: PublicKey;
        readonly fingerPrint: Buffer;

        derive(arg: string | number, hardened?: boolean): HDPublicKey;
        deriveChild(arg: string | number, hardened?: boolean): HDPublicKey;

        toString(): string;
        toObject(): object;
        toJSON(): object;
        toBuffer(): Buffer;
        toHex(): string;
        inspect(): string;

        static fromString(str: string): HDPublicKey;
        static fromObject(obj: object): HDPublicKey;
        static fromBuffer(buf: Buffer): HDPublicKey;
        static fromHex(hex:  string): HDPublicKey;

        static fromHDPrivateKey(hdPrivateKey: HDPrivateKey): HDPublicKey;
        static isValidPath(arg: string | number): boolean;
        static isValidSerialized(data: string | Buffer, network?: string | Networks.Network): boolean;
        static getSerializedError(data: string | Buffer, network?: string | Networks.Network): any | null;

    }

    export namespace Script {
        const types: {
            DATA_OUT: string;
        };
        function buildMultisigOut(publicKeys: PublicKey[], threshold: number, opts: object): Script;
        function buildWitnessMultisigOutFromScript(script: Script): Script;
        function buildMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildP2SHMultisigIn(pubkeys: PublicKey[], threshold: number, signatures: Buffer[], opts: object): Script;
        function buildPublicKeyHashOut(address: Address | string): Script;
        function buildPublicKeyOut(pubkey: PublicKey): Script;
        function buildDataOut(data: string | Buffer, encoding?: string): Script;
        function buildScriptHashOut(script: Script): Script;
        function buildPublicKeyIn(signature: crypto.Signature | Buffer, sigtype: number): Script;
        function buildPublicKeyHashIn(publicKey: PublicKey, signature: crypto.Signature | Buffer, sigtype: number): Script;

        function fromAddress(address: string | Address): Script;

        function empty(): Script;
        namespace Interpreter {
            const SCRIPT_ENABLE_SIGHASH_FORKID: any;
        }

        function Interpreter(): {
            verify: (
                inputScript: Script, 
                outputScript: Script, 
                txn: Transaction,
                nin: Number,
                flags: any,
                satoshisBN: crypto.BN
            ) => boolean
        }
    }

    export class Script {
        constructor(data?: string | object);
        readonly chunks: { opcodenum: number, buf: Uint8Array }[];

        set(obj: object): this;

        toBuffer(): Buffer;
        toASM(): string;
        toString(): string;
        toHex(): string;

        isPublicKeyHashOut(): boolean;
        isPublicKeyHashIn(): boolean;

        getPublicKey(): Buffer;
        getPublicKeyHash(): Buffer;

        isPublicKeyOut(): boolean;
        isPublicKeyIn(): boolean;

        isScriptHashOut(): boolean;
        isWitnessScriptHashOut(): boolean;
        isWitnessPublicKeyHashOut(): boolean;
        isWitnessProgram(): boolean;
        isScriptHashIn(): boolean;
        isMultisigOut(): boolean;
        isMultisigIn(): boolean;
        isDataOut(): boolean;
        isSafeDataOut(): boolean;

        getData(): Buffer;
        isPushOnly(): boolean;

        classify(): string;
        classifyInput(): string;
        classifyOutput(): string;

        isStandard(): boolean;

        prepend(obj: any): this;
        add(obj: any): this;

        hasCodeseparators(): boolean;
        removeCodeseparators(): this;

        equals(script: Script): boolean;

        getAddressInfo(): Address | boolean;
        findAndDelete(script: Script): this;
        checkMinimalPush(i: number): boolean;
        getSignatureOperationsCount(accurate: boolean): number;

        toAddress(network?: string): Address;

        static fromString(script: string): Script;
        static fromASM(script: string): Script;
        static fromHex(script: string): Script;
    }

    export interface Util {
        readonly buffer: {
            reverse(a: any): any;
        };
    }

    export namespace Networks {
        interface Network {
            readonly name: string;
            readonly alias: string;
        }

        const livenet: Network;
        const mainnet: Network;
        const testnet: Network;

        function add(data: any): Network;
        function remove(network: Network): void;
        function get(args: string | number | Network, keys: string | string[]): Network;
    }

    export class Address {
        readonly hashBuffer: Buffer;
        readonly network: Networks.Network;
        readonly type: string;

        constructor(data: Buffer | Uint8Array | string | object, network?: Networks.Network | string, type?: string);
        static fromString(address: string): Address;
        toObject(): { hash: string; type: string; network: string; };
    }

    export class Unit {
        static fromBTC(amount: number): Unit;
        static fromMilis(amount: number): Unit;
        static fromBits(amount: number): Unit;
        static fromSatoshis(amount: number): Unit;

        constructor(amount: number, unitPreference: string);

        toBTC(): number;
        toMilis(): number;
        toBits(): number;
        toSatoshis(): number;
    }

    export class BlockHeader {
        readonly bits: number;
        readonly merkleRoot: Uint8Array;
        readonly nonce: number;
        readonly prevHash: Uint8Array;
        readonly time: number;
        readonly timestamp: number;
        readonly version: number;
        readonly hash: string;
        readonly id: string;
        static fromString(header: string): BlockHeader;
        validProofOfWork(): boolean;
    }

    export const Opcode: {
        OP_FALSE: number;
        OP_0: number;
        OP_PUSHDATA1: number;
        OP_PUSHDATA2: number;
        OP_PUSHDATA4: number;
        OP_1NEGATE: number;
        OP_RESERVED: number;
        OP_TRUE: number;
        OP_1: number;
        OP_2: number;
        OP_3: number;
        OP_4: number;
        OP_5: number;
        OP_6: number;
        OP_7: number;
        OP_8: number;
        OP_9: number;
        OP_10: number;
        OP_11: number;
        OP_12: number;
        OP_13: number;
        OP_14: number;
        OP_15: number;
        OP_16: number;
        OP_NOP: number;
        OP_VER: number;
        OP_IF: number;
        OP_NOTIF: number;
        OP_VERIF: number;
        OP_VERNOTIF: number;
        OP_ELSE: number;
        OP_ENDIF: number;
        OP_VERIFY: number;
        OP_RETURN: number;
        OP_TOALTSTACK: number;
        OP_FROMALTSTACK: number;
        OP_2DROP: number;
        OP_2DUP: number;
        OP_3DUP: number;
        OP_2OVER: number;
        OP_2ROT: number;
        OP_2SWAP: number;
        OP_IFDUP: number;
        OP_DEPTH: number;
        OP_DROP: number;
        OP_DUP: number;
        OP_NIP: number;
        OP_OVER: number;
        OP_PICK: number;
        OP_ROLL: number;
        OP_ROT: number;
        OP_SWAP: number;
        OP_TUCK: number;
        OP_CAT: number;
        OP_SPLIT: number;
        OP_NUM2BIN: number;
        OP_BIN2NUM: number;
        OP_SIZE: number;
        OP_INVERT: number;
        OP_AND: number;
        OP_OR: number;
        OP_XOR: number;
        OP_EQUAL: number;
        OP_EQUALVERIFY: number;
        OP_RESERVED1: number;
        OP_RESERVED2: number;
        OP_1ADD: number;
        OP_1SUB: number;
        OP_2MUL: number;
        OP_2DIV: number;
        OP_NEGATE: number;
        OP_ABS: number;
        OP_NOT: number;
        OP_0NOTEQUAL: number;
        OP_ADD: number;
        OP_SUB: number;
        OP_MUL: number;
        OP_DIV: number;
        OP_MOD: number;
        OP_LSHIFT: number;
        OP_RSHIFT: number;
        OP_BOOLAND: number;
        OP_BOOLOR: number;
        OP_NUMEQUAL: number;
        OP_NUMEQUALVERIFY: number;
        OP_NUMNOTEQUAL: number;
        OP_LESSTHAN: number;
        OP_GREATERTHAN: number;
        OP_LESSTHANOREQUAL: number;
        OP_GREATERTHANOREQUAL: number;
        OP_MIN: number;
        OP_MAX: number;
        OP_WITHIN: number;
        OP_RIPEMD160: number;
        OP_SHA1: number;
        OP_SHA256: number;
        OP_HASH160: number;
        OP_HASH256: number;
        OP_CODESEPARATOR: number;
        OP_CHECKSIG: number;
        OP_CHECKSIGVERIFY: number;
        OP_CHECKMULTISIG: number;
        OP_CHECKMULTISIGVERIFY: number;
        OP_CHECKLOCKTIMEVERIFY: number;
        OP_CHECKSEQUENCEVERIFY: number;
        OP_NOP1: number;
        OP_NOP2: number;
        OP_NOP3: number;
        OP_NOP4: number;
        OP_NOP5: number;
        OP_NOP6: number;
        OP_NOP7: number;
        OP_NOP8: number;
        OP_NOP9: number;
        OP_NOP10: number;
        OP_CHECKDATASIG: number;
        OP_CHECKDATASIGVERIFY: number;
        OP_REVERSEBYTES: number;
        OP_STATESEPARATOR: number;
        OP_STATESEPARATORINDEX_UTXO: number;
        OP_STATESEPARATORINDEX_OUTPUT: number;
        OP_INPUTINDEX: number;
        OP_ACTIVEBYTECODE: number;
        OP_TXVERSION: number;
        OP_TXINPUTCOUNT: number;
        OP_TXOUTPUTCOUNT: number;
        OP_TXLOCKTIME: number;
        OP_UTXOVALUE: number;
        OP_UTXOBYTECODE: number;
        OP_OUTPOINTTXHASH: number;
        OP_OUTPOINTINDEX: number;
        OP_INPUTBYTECODE: number;
        OP_INPUTSEQUENCENUMBER: number;
        OP_OUTPUTVALUE: number;
        OP_OUTPUTBYTECODE: number;
        OP_SHA512_256: number;
        OP_HASH512_256: number;
        OP_PUSHINPUTREF: number;
        OP_REQUIREINPUTREF: number;
        OP_DISALLOWPUSHINPUTREF: number;
        OP_DISALLOWPUSHINPUTREFSIBLING: number;
        OP_REFHASHDATASUMMARY_UTXO: number;
        OP_REFHASHVALUESUM_UTXOS: number;
        OP_REFHASHDATASUMMARY_OUTPUT: number;
        OP_REFHASHVALUESUM_OUTPUTS: number;
        OP_PUSHINPUTREFSINGLETON: number;
        OP_REFTYPE_UTXO: number;
        OP_REFTYPE_OUTPUT: number;
        OP_REFVALUESUM_UTXOS: number;
        OP_REFVALUESUM_OUTPUTS: number;
        OP_REFOUTPUTCOUNT_UTXOS: number;
        OP_REFOUTPUTCOUNT_OUTPUTS: number;
        OP_REFOUTPUTCOUNTZEROVALUED_UTXOS: number;
        OP_REFOUTPUTCOUNTZEROVALUED_OUTPUTS: number;
        OP_REFDATASUMMARY_UTXO: number;
        OP_REFDATASUMMARY_OUTPUT: number;
        OP_CODESCRIPTHASHVALUESUM_UTXOS: number;
        OP_CODESCRIPTHASHVALUESUM_OUTPUTS: number;
        OP_CODESCRIPTHASHOUTPUTCOUNT_UTXOS: number;
        OP_CODESCRIPTHASHOUTPUTCOUNT_OUTPUTS: number;
        OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_UTXOS: number;
        OP_CODESCRIPTHASHZEROVALUEDOUTPUTCOUNT_OUTPUTS: number;
        OP_CODESCRIPTBYTECODE_UTXO: number;
        OP_CODESCRIPTBYTECODE_OUTPUT: number;
        OP_STATESCRIPTBYTECODE_UTXO: number;
        OP_STATESCRIPTBYTECODE_OUTPUT: number;
        OP_PUBKEYHASH: number;
        OP_PUBKEY: number;
        OP_INVALIDOPCODE: number;
    };
}