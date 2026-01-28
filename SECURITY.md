# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.9.x   | :white_check_mark: |
| < 1.9   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in radiantjs, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email: radiantblockchain@protonmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 7 days
- **Fix Timeline**: Depends on severity
  - Critical: 24-72 hours
  - High: 7 days
  - Medium: 30 days
  - Low: Next release

## Security Best Practices

When using radiantjs in your application:

### Key Management

```javascript
// ✅ DO: Generate keys securely
const key = radiant.PrivateKey.fromRandom();

// ✅ DO: Use environment variables
const key = new radiant.PrivateKey(process.env.PRIVATE_KEY);

// ❌ DON'T: Hardcode private keys
const key = new radiant.PrivateKey('WIF_HERE'); // NEVER!
```

### Transaction Signing

```javascript
// ✅ DO: Verify transaction before signing
const tx = new radiant.Transaction();
// ... build transaction
console.log('Outputs:', tx.outputs);
console.log('Fee:', tx.getFee());
// Review before signing
tx.sign(privateKey);

// ✅ DO: Validate addresses
if (!radiant.Address.isValid(recipientAddress)) {
  throw new Error('Invalid address');
}
```

### Browser Security

- Use Content Security Policy (CSP) headers
- Never store keys in localStorage without encryption
- Use Web Crypto API for key derivation when possible
- Validate all user inputs

## Known Limitations

1. **No Hardware Security Module (HSM) support**: Keys are managed in memory
2. **Browser environment**: Subject to browser security model
3. **Timing attacks**: While elliptic@6.5.7+ mitigates known issues, be cautious with timing-sensitive operations

## Dependency Security

This package monitors dependencies for vulnerabilities:

- `elliptic`: ^6.5.7 (timing attack fixes)
- `bn.js`: ^4.12.0
- Regular npm audit checks recommended

## Changelog

### Security Updates

- **Jan 27, 2026**: Updated elliptic to ^6.5.7, bn.js to ^4.12.0, webpack to ^5.90.0
