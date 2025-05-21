# Beautify Sidebar Menu

This feature improves the visual styling and hierarchy of the sidebar navigation component to create clearer distinction between section headers and content, remove all-uppercase text, and adjust item indentation.

## Completed Tasks

- [x] Analyze current sidebar implementation
- [x] Document proposed styling changes
- [x] Create implementation plan
- [x] Update sidebar section headers styling:
  - Remove uppercase text transform on headers
  - Enhance visual distinction between headers and content
  - Use proper capitalization instead of uppercase
- [x] Adjust item indentation:
  - Remove indentation from items below headers
  - Make items appear directly below their headers
  - Add subtle vertical line only at the beginning of menu items
  - Highlight the vertical line for active menu items
- [x] Improve visual hierarchy:
  - Increase contrast between section headers and subsection items
  - Add appropriate spacing between headers and items
  - Add hover effects to indicate interactive elements
  - Implement visual separators for clearer section boundaries
- [x] Enhance sub-menu rendering:
  - Ensure nested menus don't have additional vertical lines
  - Maintain consistent padding for nested items
  - Preserve the top-level vertical line for all levels
- [x] Fix text alignment issues:
  - Ensure consistent text alignment between active and inactive items
  - Use consistent border width with transparent color for inactive items
  - Prevent text shifting when items become active

## In Progress Tasks

- [ ] Test sidebar styling changes across different screen sizes
- [ ] Add responsiveness improvements for mobile devices
- [ ] Consider adding animation for collapsible sections
- [ ] Review accessibility of the new sidebar styling

## Future Tasks

- [ ] Test sidebar styling changes across different screen sizes
- [ ] Add responsiveness improvements for mobile devices
- [ ] Consider adding animation for collapsible sections
- [ ] Review accessibility of the new sidebar styling

## Implementation Plan

1. Modify section headers (`<h4>` tags) in `SidebarSection` component:

   - Update class to add more visual weight (font-size, font-weight)
   - Add more distinctive borders or background color
   - Add more padding/margin for better spacing

2. Update subsection headers (`<h5>` tags) in `SidebarSectionItems` component:

   - Remove the uppercase styling by removing or modifying the class `uppercase tracking-wide`
   - Ensure proper capitalization in the source data instead
   - Add more distinctive styling to separate from items

3. Remove indentation from item lists:

   - In `SidebarSectionItems`, modify the className for the `<ul>` element
   - Remove or replace the `ml-3` class that's adding the indentation
   - Ensure proper spacing between header and non-indented items

4. Enhance visual distinction:
   - Add clearer borders, background colors, or padding to section headers
   - Consider adding icons or visual indicators for collapsible sections
   - Ensure proper spacing between sections and items

## Implementation Notes

### Visual Hierarchy and Styling

- **Section Headers (h4)**:

  - Increased font size to text-xl for better prominence
  - Added clear bottom border with better color contrast (border-slate-200)
  - Added bottom margin and padding for proper spacing

- **Subsection Headers (h5)**:

  - Removed uppercase styling for better readability
  - Maintained semibold weight for distinction
  - Increased text size to lg:text-sm for better readability

- **Vertical Line Styling**:

  - Added a subtle vertical line with `border-l-2` class to provide visual structure
  - Used transparent border color for inactive items to maintain consistent spacing
  - Applied active state highlighting with colored borders for active menu items
  - Added hover effects to highlight the line when hovering over menu items
  - Used consistent padding (`pl-3`) to align all menu items
  - For nested sub-menus, ensured only the top-level vertical line is displayed

- **Interactive Elements**:
  - Added hover styles for the vertical line using Tailwind's hover: classes
  - Different hover colors for light mode (hover:border-blue-300) and dark mode (dark:hover:border-sky-400)
  - Active items have a slightly different hover effect to maintain visual distinction
  - Fixed alignment issues by ensuring consistent border width for both active and inactive items

### Code Implementation

#### Updated SidebarSection Component (h4 tag)

```tsx
<h4
  data-testid={`section-h4:${section.id}`}
  className="mb-3 mt-8 border-b border-solid border-slate-200 pb-2 text-xl font-bold dark:border-slate-700 dark:text-slate-100"
>
  {section.name}
</h4>
```

#### Updated SidebarSectionItems Component (h5 tag)

```tsx
<h5
  data-testid={`section-h5:${item.id}`}
  className={cx(
    'flex py-2',
    'text-sm font-semibold text-slate-800 lg:text-sm dark:text-slate-200',
    item.disableCollapsible ? 'cursor-text' : 'cursor-pointer'
  )}
  onClick={handleCollapseToggle}
>
```

#### List Items with Consistent Alignment and Hover Effects

```tsx
<li
  key={subItem.id + '-' + index}
  data-testid={`section-li:${subItem.id}`}
  className={cx(
    'relative pl-3',
    !isNested && 'transition-colors duration-150',
    !isNested && 'border-l-2',
    !isNested && (
      isActiveLink
        ? 'border-l-blue-500 hover:border-l-blue-600 dark:border-l-sky-500 dark:hover:border-l-sky-400'
        : 'border-l-transparent hover:border-blue-300 dark:border-l-transparent dark:hover:border-sky-400'
    )
  )}
>
```

### Relevant Files

- `nx-dev/ui-common/src/lib/sidebar.tsx` - Main sidebar component implementation
- `nx-dev/ui-common/src/lib/sidebar-container.tsx` - Container for the sidebar
