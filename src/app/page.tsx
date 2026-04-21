"use client";

import CryptoJS from "crypto-js";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";

type ChatMessage = {
  sender: string;
  encryptedText: string;
  decryptedText: string;
  timestamp: string;
};

type EncryptedPayload = {
  sender: string;
  encryptedText: string;
  timestamp: string;
};

export default function Home() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [username, setUsername] = useState("");
  const [roomId, setRoomId] = useState("security-room");
  const [secretKey, setSecretKey] = useState("assignment-shared-key");
  const [messageInput, setMessageInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isJoined, setIsJoined] = useState(false);
  const [status, setStatus] = useState(
    "Enter your name, room, and shared key.",
  );

  const connectionUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return undefined;
    }
    return window.location.origin;
  }, []);

  useEffect(() => {
    if (!connectionUrl) {
      return;
    }

    const newSocket = io(connectionUrl, {
      path: "/socket.io",
      transports: ["websocket"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setStatus("Connected. Join a room to start secure chat.");
    });

    newSocket.on("room-full", () => {
      setStatus("Room is full. This demo allows exactly two users.");
      setIsJoined(false);
    });

    newSocket.on("system-message", (text: string) => {
      setStatus(text);
    });

    newSocket.on("encrypted-message", (payload: EncryptedPayload) => {
      const decryptedText = decryptMessage(payload.encryptedText, secretKey);
      setMessages((prev) => [
        ...prev,
        {
          sender: payload.sender,
          encryptedText: payload.encryptedText,
          decryptedText,
          timestamp: payload.timestamp,
        },
      ]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [connectionUrl, secretKey]);

  function joinRoom() {
    if (!socket) {
      setStatus("Socket is not ready yet.");
      return;
    }
    if (!username.trim() || !roomId.trim() || !secretKey.trim()) {
      setStatus("All fields are required.");
      return;
    }

    socket.emit("join-chat", {
      roomId: roomId.trim(),
      username: username.trim(),
    });
    setIsJoined(true);
    setStatus("Joined room. Waiting for second participant...");
  }

  function sendMessage() {
    if (!socket || !isJoined) {
      setStatus("Join a room before sending messages.");
      return;
    }
    if (!messageInput.trim()) {
      return;
    }

    const encryptedText = encryptMessage(messageInput.trim(), secretKey);
    const payload: EncryptedPayload = {
      sender: username,
      encryptedText,
      timestamp: new Date().toLocaleTimeString(),
    };

    socket.emit("encrypted-message", payload);
    setMessageInput("");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">AES Encrypted Two-User Chat</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        Socket.IO relays ciphertext only. Both users must share the same room
        and AES key.
      </p>
      <Link
        href="/public"
        className="w-fit rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        View Public Ciphertext Monitor
      </Link>

      <section className="grid gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <input
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Username (e.g. Alice)"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          disabled={isJoined}
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Room ID"
          value={roomId}
          onChange={(event) => setRoomId(event.target.value)}
          disabled={isJoined}
        />
        <input
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          placeholder="Shared AES key"
          value={secretKey}
          onChange={(event) => setSecretKey(event.target.value)}
          disabled={isJoined}
        />
        <button
          type="button"
          className="rounded bg-black px-3 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
          onClick={joinRoom}
          disabled={isJoined}
        >
          Join Secure Room
        </button>
        <p className="text-sm">{status}</p>
      </section>

      <section className="flex min-h-[320px] flex-col gap-3 rounded-lg border border-zinc-300 p-4 dark:border-zinc-700">
        <div className="flex-1 space-y-3 overflow-y-auto">
          {messages.map((message, index) => (
            <article
              key={`${message.timestamp}-${index}`}
              className="rounded border p-3 text-sm"
            >
              <p>
                <strong>{message.sender}</strong> at {message.timestamp}
              </p>
              <p>Encrypted: {message.encryptedText}</p>
              <p>Decrypted: {message.decryptedText}</p>
            </article>
          ))}
          {messages.length === 0 ? (
            <p className="text-sm text-zinc-500">No messages yet.</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Type message"
            value={messageInput}
            onChange={(event) => setMessageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                sendMessage();
              }
            }}
          />
          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black"
            onClick={sendMessage}
          >
            Send
          </button>
        </div>
      </section>
    </main>
  );
}

function encryptMessage(plainText: string, secretKey: string): string {
  return CryptoJS.AES.encrypt(plainText, secretKey).toString();
}

function decryptMessage(cipherText: string, secretKey: string): string {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secretKey);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted || "[unable to decrypt with current key]";
  } catch {
    return "[decryption failed]";
  }
}
