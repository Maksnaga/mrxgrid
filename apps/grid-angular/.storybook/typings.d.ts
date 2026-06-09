declare module '*.md' {
  const content: string;
  export default content;
}

declare module '*.mdx' {
  const MDXComponent: (props: Record<string, unknown>) => JSX.Element;
  export default MDXComponent;
}

declare module '@mozaic-ds/tokens' {
  const tokens: Record<string, unknown>;
  export default tokens;
}
