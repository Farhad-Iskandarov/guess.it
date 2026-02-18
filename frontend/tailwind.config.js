/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
        extend: {
                fontFamily: {
                        sans: ['Inter', 'system-ui', 'sans-serif'],
                },
                borderRadius: {
                        lg: 'var(--radius-lg)',
                        md: 'var(--radius)',
                        sm: 'calc(var(--radius) - 4px)',
                        xl: 'var(--radius-xl)',
                },
                colors: {
                        background: 'hsl(var(--background))',
                        'background-secondary': 'hsl(var(--background-secondary))',
                        foreground: 'hsl(var(--foreground))',
                        card: {
                                DEFAULT: 'hsl(var(--card))',
                                foreground: 'hsl(var(--card-foreground))',
                                hover: 'hsl(var(--card-hover))',
                        },
                        popover: {
                                DEFAULT: 'hsl(var(--popover))',
                                foreground: 'hsl(var(--popover-foreground))'
                        },
                        primary: {
                                DEFAULT: 'hsl(var(--primary))',
                                foreground: 'hsl(var(--primary-foreground))',
                                glow: 'hsl(var(--primary-glow))',
                        },
                        secondary: {
                                DEFAULT: 'hsl(var(--secondary))',
                                foreground: 'hsl(var(--secondary-foreground))'
                        },
                        cta: {
                                DEFAULT: 'hsl(var(--cta))',
                                foreground: 'hsl(var(--cta-foreground))',
                                hover: 'hsl(var(--cta-hover))',
                        },
                        muted: {
                                DEFAULT: 'hsl(var(--muted))',
                                foreground: 'hsl(var(--muted-foreground))'
                        },
                        accent: {
                                DEFAULT: 'hsl(var(--accent))',
                                foreground: 'hsl(var(--accent-foreground))'
                        },
                        destructive: {
                                DEFAULT: 'hsl(var(--destructive))',
                                foreground: 'hsl(var(--destructive-foreground))'
                        },
                        border: 'hsl(var(--border))',
                        'border-hover': 'hsl(var(--border-hover))',
                        input: 'hsl(var(--input))',
                        ring: 'hsl(var(--ring))',
                        vote: {
                                active: 'hsl(var(--vote-active))',
                                'active-bg': 'hsl(var(--vote-active-bg))',
                                inactive: 'hsl(var(--vote-inactive))',
                                'inactive-hover': 'hsl(var(--vote-inactive-hover))',
                        },
                        chip: {
                                active: 'hsl(var(--chip-active))',
                                inactive: 'hsl(var(--chip-inactive))',
                        },
                        text: {
                                primary: 'hsl(var(--text-primary))',
                                secondary: 'hsl(var(--text-secondary))',
                                muted: 'hsl(var(--text-muted))',
                        },
                        chart: {
                                '1': 'hsl(var(--chart-1))',
                                '2': 'hsl(var(--chart-2))',
                                '3': 'hsl(var(--chart-3))',
                                '4': 'hsl(var(--chart-4))',
                                '5': 'hsl(var(--chart-5))'
                        }
                },
                keyframes: {
                        'accordion-down': {
                                from: {
                                        height: '0'
                                },
                                to: {
                                        height: 'var(--radix-accordion-content-height)'
                                }
                        },
                        'accordion-up': {
                                from: {
                                        height: 'var(--radix-accordion-content-height)'
                                },
                                to: {
                                        height: '0'
                                }
                        },
                        'slide-in': {
                                from: {
                                        opacity: '0',
                                        transform: 'translateY(10px)'
                                },
                                to: {
                                        opacity: '1',
                                        transform: 'translateY(0)'
                                }
                        },
                        'fade-in': {
                                from: {
                                        opacity: '0'
                                },
                                to: {
                                        opacity: '1'
                                }
                        },
                        'scale-in': {
                                from: {
                                        opacity: '0',
                                        transform: 'scale(0.95)'
                                },
                                to: {
                                        opacity: '1',
                                        transform: 'scale(1)'
                                }
                        }
                },
                animation: {
                        'accordion-down': 'accordion-down 0.2s ease-out',
                        'accordion-up': 'accordion-up 0.2s ease-out',
                        'slide-in': 'slide-in 0.3s ease-out',
                        'fade-in': 'fade-in 0.3s ease-out',
                        'scale-in': 'scale-in 0.2s ease-out',
                }
        }
  },
  plugins: [require("tailwindcss-animate")],
};
