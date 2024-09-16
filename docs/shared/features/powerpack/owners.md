# Define Code Ownership at the Project Level

```json
{
  "owners": {
    "format": "github",
    "patterns": [
      {
        "description": "Joe should double check all changes to rust code",
        "projects": ["tag:rust"],
        "owners": ["@joelovesrust"]
      },
      {
        "description": "The Finance team owns these projects",
        "projects": ["finance-*"],
        "owners": ["@finance-team"]
      },
      {
        "description": "Alice, Bob and Cecil work together on these projects",
        "projects": ["admin", "booking", "cart"],
        "owners": ["@alice", "@bob", "@cecil"]
      },
      {
        "description": "CI Workflows",
        "files": [".github/workflows/**/*"],
        "owners": ["@devops"]
      }
    ]
  }
}
```

```json
{
  "owners": {
    "**/*": ["@ahmed", "@petra"],
    "package.json": ["@ahmed"],
  },
};
```
