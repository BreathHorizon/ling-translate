I will implement the functionality to export and import all configuration settings in the Options page.

### 1. Modify `src/options/Options.tsx`
I will add "Export Configuration" and "Import Configuration" buttons to the "General Settings" tab.

**Implementation Details:**

- **Export Functionality**:
  - Create a `handleExportSettings` function that takes the current `settings` from the store.
  - Convert the settings object to a formatted JSON string.
  - Create a temporary blob and download link to trigger a file download named `ling-translate-settings.json`.

- **Import Functionality**:
  - Create a hidden `<input type="file" />` element to handle file selection.
  - Create a `handleImportSettings` function to parse the selected JSON file.
  - Validate that the imported JSON is a valid object.
  - Use the existing `updateSettings` function from `useStore` to apply the imported settings.
  - Show a success or error alert to the user.

- **UI Changes**:
  - Add a new "Configuration Management" section in the "General Settings" tab.
  - Add two buttons: "Export Settings" and "Import Settings" with appropriate styling to match the existing UI.
