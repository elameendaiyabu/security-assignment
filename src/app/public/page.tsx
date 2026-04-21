"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PublicMessage = {
  sender: string;
  encryptedText: string;
  timestamp: string;
};

type PublicRoom = {
  roomId: string;
  participantCount: number;
  encryptedMessages: PublicMessage[];
};

type PublicFeedResponse = {
  rooms: PublicRoom[];
};

export default function PublicMonitorPage() {
  const [rooms, setRooms] = useState<PublicRoom[]>([]);
  const [status, setStatus] = useState("Loading encrypted traffic...");

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      try {
        const response = await fetch("/api/public-feed");
        if (!response.ok) {
          throw new Error("Failed to fetch public feed.");
        }
        const data = (await response.json()) as PublicFeedResponse;
        if (!isMounted) {
          return;
        }
        setRooms(data.rooms);
        setStatus("Encrypted traffic monitor (ciphertext only).");
      } catch {
        if (!isMounted) {
          return;
        }
        setStatus("Unable to load feed right now.");
      }
    }

    loadFeed();
    const intervalId = setInterval(loadFeed, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-bold">Public Ciphertext Monitor</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">
        This page can see room IDs and encrypted messages but cannot decrypt
        content without the correct shared key.
      </p>
      <Link
        href="/"
        className="w-fit rounded border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Back to Secure Chat
      </Link>
      <p className="text-sm">{status}</p>

      <section className="grid gap-4">
        {rooms.length === 0 ? (
          <article className="rounded-lg border border-zinc-300 p-4 text-sm dark:border-zinc-700">
            No rooms have encrypted messages yet.
          </article>
        ) : (
          rooms.map((room) => (
            <article
              key={room.roomId}
              className="rounded-lg border border-zinc-300 p-4 dark:border-zinc-700"
            >
              <h2 className="text-lg font-semibold">Room: {room.roomId}</h2>
              <p className="mb-3 text-sm">
                Connected participants: {room.participantCount}
              </p>
              {room.encryptedMessages.length === 0 ? (
                <p className="text-sm text-zinc-500">No encrypted messages.</p>
              ) : (
                <div className="space-y-2">
                  {room.encryptedMessages.map((message, index) => (
                    <div
                      key={`${room.roomId}-${message.timestamp}-${index}`}
                      className="rounded border p-2 text-sm"
                    >
                      <p>
                        <strong>{message.sender}</strong> at {message.timestamp}
                      </p>
                      <p className="break-all">
                        Ciphertext: {message.encryptedText}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))
        )}
      </section>
    </main>
  );
}
