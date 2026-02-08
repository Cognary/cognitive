---
sidebar_position: 6
---

# ui-spec-generator

Generate UI specifications and component designs.

## Basic Info

| Property | Value |
|----------|-------|
| Version | 1.0.0 |
| Tier | exploration |
| Category | Design Specs |
| Format | New Format |

## Features

- Generate page layouts
- Define component hierarchy
- Specify interaction patterns
- Include responsive considerations

## Usage

```bash
npx cogn@2.2.11 run ui-spec-generator --args "e-commerce product listing page with filters and sorting" --pretty
```

## Output Example

```json
{
  "page_name": "Product Listing",
  "layout": {
    "type": "grid",
    "areas": [
      "header header header",
      "filters products products",
      "filters pagination pagination"
    ]
  },
  "components": [
    {
      "name": "FilterSidebar",
      "type": "sidebar",
      "position": "left",
      "children": [
        {
          "name": "CategoryFilter",
          "type": "checkbox-group",
          "props": { "options": "dynamic", "multiSelect": true }
        },
        {
          "name": "PriceRangeFilter",
          "type": "range-slider",
          "props": { "min": 0, "max": "dynamic", "step": 10 }
        }
      ]
    },
    {
      "name": "ProductGrid",
      "type": "grid",
      "props": { "columns": { "mobile": 1, "tablet": 2, "desktop": 4 } },
      "children": [
        {
          "name": "ProductCard",
          "type": "card",
          "props": { "image": true, "title": true, "price": true, "rating": true }
        }
      ]
    },
    {
      "name": "SortDropdown",
      "type": "select",
      "position": "top-right",
      "props": {
        "options": ["Price: Low to High", "Price: High to Low", "Newest", "Best Rated"]
      }
    }
  ],
  "interactions": [
    {
      "trigger": "filter change",
      "action": "update ProductGrid with filtered results",
      "loading": "skeleton on ProductGrid"
    },
    {
      "trigger": "sort change",
      "action": "reorder ProductGrid items",
      "animation": "fade transition"
    }
  ],
  "responsive": {
    "mobile": "FilterSidebar becomes bottom sheet",
    "tablet": "2-column product grid",
    "desktop": "4-column product grid"
  },
  "rationale": "Grid layout optimizes product visibility...",
  "confidence": 0.85
}
```

## Output Fields

| Field | Type | Description |
|-------|------|-------------|
| `page_name` | string | Page name |
| `layout` | object | Page layout definition |
| `components` | array | Component tree |
| `components[].name` | string | Component name |
| `components[].type` | string | Component type |
| `components[].props` | object | Component properties |
| `components[].children` | array | Nested components |
| `interactions` | array | User interactions |
| `responsive` | object | Responsive breakpoints |
| `rationale` | string | Design reasoning |
| `confidence` | number | Confidence 0-1 |

## Design Principles

- Mobile-first responsive design
- Consistent component hierarchy
- Clear interaction patterns
- Accessibility considerations
