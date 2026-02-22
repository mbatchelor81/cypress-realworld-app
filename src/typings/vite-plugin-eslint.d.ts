declare module "vite-plugin-eslint" {
  import { Plugin } from "vite";

  interface ESLintOptions {
    cache?: boolean;
    fix?: boolean;
    include?: string | string[];
    exclude?: string | string[];
    formatter?: string;
    emitWarning?: boolean;
    emitError?: boolean;
    failOnWarning?: boolean;
    failOnError?: boolean;
  }

  export default function eslint(options?: ESLintOptions): Plugin;
}
