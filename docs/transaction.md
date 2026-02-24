# Transaction

`radiantjs` provides a simple but powerful API for creating transactions. This guide will walk you through the basics of creating standard Radiant (RXD) transactions as well as advanced token transactions using the Glyph protocol.

## Anatomy of a Transaction

A Transaction contains a set of inputs and a set of outputs.
- Each **input** references a previous transaction's output that you have the authority to spend. It includes a digital signature to prove that authority.
- Each **output** specifies an amount of satoshis (the smallest unit of RXD) and a locking script (an "address") that defines who can spend those satoshis in the future.

An output can only be spent once in its entirety. This is why the concept of "change" is fundamental. If you have an unspent transaction output (UTXO) of 10 RXD but you only want to send 1 RXD, you'll create a transaction with two outputs:
1.  An output of 1 RXD to your recipient.
2.  An output of ~9 RXD (minus the transaction fee) back to a "change" address that you control.

To create a valid transaction, you need a set of UTXOs that you can spend.

## Creating a Standard Transaction

Here is a basic example of creating and signing a standard RXD transaction:

```javascript
import { Transaction, PrivateKey } from '@radiant-core/radiantjs';

// UTXOs (Unspent Transaction Outputs) you own.
// This data usually comes from an indexer like RXinDexer.
const utxos = [
    {
        txId: 'a477af6b2667c29670467e4e0728b685ee07b240235771862318e29ddbe58458',
        outputIndex: 0,
        script: '76a9148bf10d323ac7e92159525a34b295c52cca290f6988ac', // Script from P2PKH address
        satoshis: 100000 // 0.001 RXD
    }
];

const privateKey = new PrivateKey('your-private-key-in-WIF-format');
const sendToAddress = 'rRecipientAddressHere...';
const changeAddress = 'rYourChangeAddressHere...';

const transaction = new Transaction()
    .from(utxos)
    .to(sendToAddress, 10000) // Send 10000 satoshis
    .change(changeAddress)
    .sign(privateKey);

// The transaction is now ready to be broadcast.
const serializedTx = transaction.serialize();

// You can now send `serializedTx` to the network via a radiantd node's
// 'sendrawtransaction' RPC command.
```

You can get the total input and output amounts in satoshis via the `inputAmount` and `outputAmount` properties.

### Specifying a Fee

You can manually set a transaction fee (in satoshis) instead of relying on automatic calculation.

```javascript
const transaction = new Transaction().fee(1000); // Set a 1000 satoshi fee
```

## Creating a Glyph Token Transaction

`radiantjs` has built-in support for the Glyph v2 token protocol. The `Transaction` class is extended with a `Glyph` helper to construct token operations.

### Creating a New NFT

This example shows how to create the reveal transaction for a new NFT.

```javascript
import { Transaction, PrivateKey, Glyph, Script } from '@radiant-core/radiantjs';

const privateKey = new PrivateKey('your-private-key-in-WIF-format');
const address = privateKey.toAddress();
const utxos = [/* ... your UTXOs for funding ... */];

// 1. Define the NFT's metadata
const metadata = {
    v: 2,
    p: [2], // Protocol ID 2 for NFT
    name: "My First Radiant NFT",
    desc: "This is a unique digital asset on the Radiant blockchain.",
    content: {
        primary: {
            path: 'image.png',
            mime: 'image/png',
            storage: 'inline'
        }
    }
};

const content = Buffer.from('your image data here');

// 2. Create the Glyph object
const glyph = new Glyph(metadata, content);

// 3. Construct the reveal transaction
const transaction = new Transaction()
    .from(utxos)
    .addGlyph(glyph.reveal(address, 1)) // Reveal to your address, 1 photon backing
    .change(address)
    .sign(privateKey);

const serializedRevealTx = transaction.serialize();
```

### Transferring a Token

To transfer a Glyph token, you simply spend the UTXO that holds the token reference.

```javascript
const privateKey = new PrivateKey('owner-private-key');
const ownerAddress = privateKey.toAddress();
const recipientAddress = 'rRecipientAddress...';

// The UTXO containing the Glyph token
const tokenUtxo = {
    txId: '...glyph-tx-id...',
    outputIndex: 0, // The vout holding the token
    script: Script.fromAddress(ownerAddress).toHex(),
    satoshis: 1 // The photon backing amount
};

// A separate UTXO to pay for transaction fees
const fundingUtxo = { /* ... */ };

const transaction = new Transaction()
    .from([tokenUtxo, fundingUtxo])
    .to(recipientAddress, 1) // Send the token (1 photon) to the new owner
    .change(ownerAddress)
    .sign(privateKey);

const serializedTransferTx = transaction.serialize();
```

## Multisig Transactions
To spend an output that requires multiple signatures, you need to provide the public keys of the signers and the required threshold.

```javascript
const multiSigTx = new Transaction()
    .from(utxo, publicKeys, threshold)
    .change(address)
    .sign(myKeys);

const serialized = multiSigTx.toObject();
```

This serialized transaction can then be passed to another party to add their signature:

```javascript
const multiSigTx = new Transaction(serialized)
    .sign(anotherSetOfKeys);

assert(multiSigTx.isFullySigned());
```

## Data Outputs (OP_RETURN)
You can add arbitrary data to a transaction using `OP_RETURN` outputs.

```javascript
// Add a standard OP_RETURN
const transaction = new Transaction()
    .addData('Your data here'); // Can be a string or Buffer

// Add a "safe" OP_FALSE OP_RETURN (provably unspendable)
const transaction = new Transaction()
    .addSafeData('Your safe data here');
```

## Time-Locking Transactions
Transactions contain a locktime field, which indicates the earliest time a transaction can be added to the blockchain.

```javascript
// Lock until a specific date
const futureDate = new Date(2027, 1, 1);
const tx1 = new Transaction().lockUntilDate(futureDate);

// Lock until a specific block height
const tx2 = new Transaction().lockUntilBlockHeight(500000);

console.log(tx1.getLockTime());
//> e.g., 2027-02-01T00:00:00.000Z
console.log(tx2.getLockTime());
//> 500000
```
