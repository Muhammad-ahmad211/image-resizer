import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: ["legacy/**", ".next/**", "out/**", "next-env.d.ts"] },
];

export default config;
