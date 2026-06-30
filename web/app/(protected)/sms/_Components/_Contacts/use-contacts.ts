"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "sms.contacts";

type ContactMap = Record<string, string>;

export interface ContactsApi {
  displayName: (phoneNumber: string) => string;
  hasContact: (phoneNumber: string) => boolean;
  setContactName: (phoneNumber: string, name: string) => void;
}

export function useContacts(): ContactsApi {
  const [contacts, setContacts] = useState<ContactMap>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);

      if (raw) setContacts(JSON.parse(raw));
    } catch {
      // Ignore parse errors — fall back to empty contacts.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    } catch {
      // Ignore quota / privacy-mode errors.
    }
  }, [contacts, hydrated]);

  function setContactName(phoneNumber: string, name: string) {
    setContacts((prev) => {
      const next = { ...prev };
      const trimmed = name.trim();

      if (trimmed.length === 0) {
        delete next[phoneNumber];
      } else {
        next[phoneNumber] = trimmed;
      }

      return next;
    });
  }

  function displayName(phoneNumber: string): string {
    return contacts[phoneNumber] ?? phoneNumber;
  }

  function hasContact(phoneNumber: string): boolean {
    return phoneNumber in contacts;
  }

  return { displayName, hasContact, setContactName };
}
