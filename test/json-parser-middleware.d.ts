import { IContainer } from "hardwired";
declare global {
    namespace Express {
        interface Request {
            container: IContainer;
            rawBody?: string;
        }
    }
}
declare const _default: () => import("connect").NextHandleFunction;
export default _default;
