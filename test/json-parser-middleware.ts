import express, { Request, Response } from "express";
import { IContainer } from "hardwired";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    export interface Request {
      container: IContainer;
      rawBody?: string;
    }
  }
}
export default () =>
  express.json({
    verify: (req: Request, res: Response, buf: Buffer, encoding: BufferEncoding) => {
      if (buf && buf.length) {
        req.rawBody = buf.toString(encoding ?? "utf8");
      }
    },
  });
