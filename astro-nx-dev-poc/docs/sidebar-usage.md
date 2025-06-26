# Dynamic Sidebar Component

This project now includes a dynamic sidebar component that mimics the behavior of the official Astro docs implementation.

## Features

- **Dynamic Group Tabs**: The sidebar automatically shows different groups (Getting Started, Guides, Reference, Plugins) as tabs
- **URL-based Tab Switching**: Automatically switches to the appropriate tab based on the current URL
- **Flexible Configuration**: Easy to add new groups via the configuration file
- **Responsive Design**: Works well on mobile and desktop
- **Persistent State**: Remembers the user's tab preference

## Configuration

The sidebar groups are configured in `/src/config/sidebar.config.ts`. Each group has:

```typescript
interface SidebarGroup {
  id: string; // Unique identifier
  label: string; // Display label
  icon?: string; // Optional emoji icon
  urlPattern: RegExp; // URL pattern to match
  priority?: number; // Priority for pattern matching
  items: SidebarItem[]; // Sidebar items for this group
}
```

## Adding New Groups

To add a new group, edit `/src/config/sidebar.config.ts`:

```typescript
{
  id: 'tutorials',
  label: 'Tutorials',
  icon: '📖',
  urlPattern: /^\/tutorials\//,
  priority: 5,
  items: [
    {
      label: 'Tutorials',
      autogenerate: { directory: 'tutorials' },
    },
  ],
}
```

## How It Works

1. The sidebar checks the current URL against each group's `urlPattern`
2. When a match is found, that tab becomes active
3. The sidebar content updates to show only items from the active group
4. Users can manually switch tabs, and their preference is saved

## URL Patterns

- `/getting-started/*` → Getting Started tab
- `/guides/*` → Guides tab
- `/api/*` or `/reference/*` → Reference tab
- `/plugins/*` → Plugins tab

## Customization

The component can be further customized by:

- Modifying the styles in the `<style>` section of `Sidebar.astro`
- Adding new group types in the configuration
- Implementing additional features like search or filtering
