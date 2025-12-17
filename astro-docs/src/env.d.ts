/// <reference types="astro/client" />
/// <reference types="@astrojs/starlight/locals" />

// Extend `Astro.locals` with properties added by our middlewares
declare namespace App {
  interface Locals {
    githubStarsCount?: number;
    rawContent?: string;
  }
}
