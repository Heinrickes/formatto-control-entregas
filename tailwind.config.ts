import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        formatto: {
          orange: "#CE4620",
          black: "#111111",
          paper: "#EFEEEB",
          line: "#E0DFD9",
          muted: "#6B6B65"
        }
      },
      borderRadius: {
        formatto: "7px"
      }
    }
  },
  plugins: []
};

export default config;
