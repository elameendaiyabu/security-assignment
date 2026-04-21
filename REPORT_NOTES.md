# Confidentiality Security Assignment Report Notes

## Objective

The objective of this project is to demonstrate **confidentiality** in communication by building a two-user chat system where:

- Messages are encrypted before leaving the sender.
- The server relays ciphertext and does not decrypt content.
- A public monitoring page can view encrypted traffic but cannot read plaintext.

This proves that access to network data alone is not enough; users also need the correct shared key to decrypt messages.

## Tech Stack

- **Frontend / App Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Realtime Messaging:** Socket.IO (`socket.io`, `socket.io-client`)
- **Encryption Library:** `crypto-js` (AES)
- **Server Mode:** Custom Node server (`server.js`) hosting both Next.js and Socket.IO
- **Styling:** Tailwind CSS

## Why a Custom Server Was Used

Socket.IO requires access to the underlying HTTP server. To support this reliably, the app uses a custom Node server (`server.js`) instead of only `next dev` / `next start`.

`package.json` scripts were changed to:

- `dev`: `node server.js`
- `start`: `NODE_ENV=production node server.js`

This allows Next.js pages and Socket.IO events to run on the same server instance.

## Core Architecture

### 1) Secure Chat Page (`/`)

Implemented in `src/app/page.tsx`.

The page allows users to:

- Enter `username`
- Enter a `roomId`
- Enter a shared AES `secretKey`
- Join room (max 2 participants)
- Send and receive messages in real time

Each chat message displays:

- Sender and timestamp
- Encrypted text (ciphertext)
- Decrypted text (computed locally with the current key)

### 2) Socket.IO + Message Relay

Implemented in `server.js`.

Server event flow:

- `join-chat`: user joins room if room is not full (max 2).
- `encrypted-message`: server receives payload and broadcasts to room.
- `disconnect`: server emits system leave message.

Important design choice:

- Server relays encrypted payload and does not perform AES decryption.

### 3) Public Ciphertext Monitor (`/public`)

Implemented in `src/app/public/page.tsx` and API endpoint in `server.js` (`GET /api/public-feed`).

Purpose:

- Demonstrates an observer/attacker-like view.
- Shows room IDs, participant counts, and encrypted messages only.
- Does not show plaintext, proving key-dependent confidentiality.

## Encryption Design

### Client-side AES

In `src/app/page.tsx`:

- Encrypt before send:
  - `CryptoJS.AES.encrypt(plainText, secretKey).toString()`
- Decrypt after receive:
  - `CryptoJS.AES.decrypt(cipherText, secretKey).toString(CryptoJS.enc.Utf8)`

### Under the hood (CryptoJS passphrase API)

Because `secretKey` is provided as a string, CryptoJS treats it as a passphrase (not a raw AES key). Internally it derives the AES key and IV using an OpenSSL-compatible KDF (historically `EVP_BytesToKey`) with a random salt, then encrypts using AES-CBC with PKCS#7 padding.

Security implication:

- This provides confidentiality, but not built-in authenticity/integrity.
- For stronger modern guarantees, prefer AEAD (for example AES-GCM via Web Crypto) or Encrypt-then-MAC.

### Message Payload

Encrypted chat payload structure:

- `sender: string`
- `encryptedText: string`
- `timestamp: string`

No plaintext is sent over socket events.

## Data Flow

1. User writes plaintext message on `/`.
2. Message is encrypted in browser using AES + shared key.
3. Client sends ciphertext payload to server via Socket.IO.
4. Server relays ciphertext to room participants.
5. Receiving client decrypts ciphertext locally using key.
6. Public route (`/public`) can fetch message history but sees ciphertext only.

## Confidentiality Demonstration

The app demonstrates confidentiality by separating:

- **Transport visibility** (what observers can see): room IDs + ciphertext
- **Content readability** (what authorized users can read): plaintext after decryption

If an observer sees the data from `/public`, they still cannot read messages without the shared key.

## Security-Relevant Features Implemented

- Room capacity check (`max 2`) to match assignment constraints.
- Shared-key-based message confidentiality with AES.
- Server-side relay without plaintext handling.
- Public monitoring endpoint to demonstrate ciphertext-only visibility.
- Graceful decrypt failure message when key is wrong.

## Limitations (Important for Report)

This is a teaching/demo implementation, not production-grade end-to-end security. Key limitations:

1. **Key exchange is out of scope**  
   Users manually share the AES key. If key sharing channel is insecure, confidentiality can be broken.

2. **Passphrase-based AES API**  
   `CryptoJS.AES.encrypt(text, passphrase)` is convenient but not a full modern protocol design (e.g., explicit key derivation parameters and authentication strategy discussion are omitted).

3. **No user authentication/authorization**  
   Anyone who knows room ID and key can join and decrypt.

4. **In-memory message storage only**  
   Public feed/history is stored in memory (`Map`), resets when server restarts.

5. **No integrity/authentication tag handling by app protocol**  
   The demo focuses on confidentiality and does not include custom signature verification, replay protection, or message authentication at protocol level.

6. **No HTTPS/TLS termination setup in project scope**  
   In deployment, HTTPS is required to protect metadata and active session traffic.

## How to Demonstrate in Presentation

Suggested demo script:

1. Open two browser windows (User A and User B).
2. Both enter same room ID and same key; use different usernames.
3. Send a few messages.
4. Open `/public` on a new tab and show that only ciphertext is visible.
5. Change key in one chat client and show decrypt failure for received ciphertext.
6. Explain that without correct key, intercepted messages remain unreadable.