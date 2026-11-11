
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./resources/**/*.blade.php",
    "./resources/**/*.js",
    "./resources/**/*.ts",
    "./resources/**/*.jsx",
    "./resources/**/*.tsx",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",

        primary: "var(--primary)",
        "primary-foreground": "var(--primary-foreground)",

        secondary: "var(--secondary)",
        "secondary-foreground": "var(--secondary-foreground)",

        tertiary: "var(--tertiary)",
        "tertiary-foreground": "var(--tertiary-foreground)",

        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",

        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",

        muted: "var(--muted)",
        "muted-foreground": "var(--muted-foreground)",

        accent: "var(--accent)",
        "accent-foreground": "var(--accent-foreground)",

        graphite: "#343442",
        petrol: "#347B78",
        violet: "#7376A6",
        steel: "#718EAA",
        taupe: "#B6A99E",
        stone: "#B6A99E",
        silver: "#B6A99E",
        platinum: "#E9E1D5",
        copper: "#BD8067",
        amber: "#C9A875",
      },
    },
  },
  plugins: [],
};
