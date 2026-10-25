declare module 'pg-format' {
  const format: {
    (format: string, ...args: unknown[]): string;
    ident: (val: string) => string;
    literal: (val: unknown) => string;
    string: (val: string) => string;
  };
  export default format;
}