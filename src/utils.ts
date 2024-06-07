import fs from "fs";
import path from "path";
import url from "url";
import crypto from "crypto";
import z from "zod";

export function raise(error?: string | Error): never {
  throw typeof error === "string" ? new Error(error) : error ?? new Error();
}

export function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function dateReplacer(this: any, key: string, value: unknown) {
  if (this[key] instanceof Date) {
    return { $date: value };
  } else {
    return value;
  }
}

export function dateReviver(key: string, value: unknown) {
  if (typeof value === "object" && value !== null && "$date" in value) {
    return new Date(value.$date as string);
  }
  return value;
}

export function decodeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((val) => decodeObject(val));
  }
  if (typeof value === "object" && value !== null) {
    if ("$date" in value && typeof value.$date === "string") {
      return new Date(value.$date);
    } else {
      return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, decodeObject(val)]));
    }
  }
  return value;
}

export function encodeObject(value: unknown): unknown {
  if (value instanceof Date) {
    return { $date: value.toISOString() };
  }
  if (Array.isArray(value)) {
    return value.map((val) => encodeObject(val));
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, val]) => [key, encodeObject(val)]));
  }
  return value;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 1000, 64, "sha512", (err, key) => {
      if (err) return reject(err);
      resolve(key.toString("hex"));
    });
  });
}

export function loadTextFile(filename: string) {
  const __dirname = url.fileURLToPath(new URL("../../src/lib/generators", import.meta.url));
  return fs.readFileSync(path.resolve(__dirname, filename), "utf-8");
}

export function hashBy<T extends object, TKey extends keyof T>(
  array: T[],
  key: TKey | ((element: T) => string)
): Record<string, T> {
  const keyIsFunction = typeof key === "function";
  return array.reduce((memo, element) => {
    memo[keyIsFunction ? (key(element) as string) : (element[key] as string)] = element;
    return memo;
  }, <Record<string, T>>{});
}

type Ok<T> = { result: "ok"; ok: true; value: T };
type Err<E> = { result: "error"; ok: false; error: E };

export type ResultSync<T, E = undefined> = E extends undefined ? Ok<T> : Ok<T> | Err<E>;
export type Result<T, E = undefined> = Promise<ResultSync<T, E>>;

const ok = <T>(value: T): Ok<T> => ({ result: "ok" as const, ok: true as const, value });
const err = <E>(error: E): Err<E> => ({ result: "error" as const, ok: false as const, error });
const done = () => ok(undefined);

export const Result = { ok, err, done };

export type DateString = string;
export const DateString = z
  .string()
  .refine((val) => !isNaN(new Date(val).getMilliseconds()), { message: "Invalid Date" });
