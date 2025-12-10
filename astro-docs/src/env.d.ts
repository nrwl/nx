/// <reference types="astro/client" />
/// <reference types="@astrojs/starlight/locals" />

// Extend `Astro.locals` with properties added by our middlewares
declare namespace App {
  interface Locals {
    githubStarsCount?: number;
    floatingBanner?: {
      id: string;
      title: string;
      description: string;
      primaryCtaUrl: string;
      primaryCtaText: string;
      secondaryCtaUrl?: string;
      secondaryCtaText?: string;
      enabled: boolean;
    };
  }
}
