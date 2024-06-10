export type LoggerLevel = "debug" | "verbose" | "info" | "warn" | "error" | "silent";

export default interface IRequestLogger {
  debug(message: string, payload?: object): void;
  verbose(message: string, payload?: object): void;
  info(message: string, payload?: object): void;
  warn(message: string, payload?: object): void;
  error(message: string, payload?: object): void;
  flush(): void;
}
