# Roll20 Height Marker Script

A custom Roll20 API script that allows users to assign height markers to tokens based on specified heights. By entering a chat command followed by a height value, the script applies a corresponding custom token marker to the selected token(s). Only works with **DnD20Play Improved Height Markers** as of now or a custom set with same naming convention. Hopefully, shouldn't be too hard to update to another marker set.

## Features

- **Assign Height Markers**: Easily apply custom height markers to tokens using chat commands.
- **Positive and Negative Heights**: Supports both above-ground (positive) and below-ground (negative) heights.
- **Automatic Marker Removal**: Removes existing height markers before applying new ones to prevent stacking.
- **Input Validation**: Ensures that height values are divisible by 5 and within the range of -300 to 300.
- **User Feedback**: Provides whisper messages to users for invalid inputs or errors.

## Requirements

- **Roll20 Pro Subscription**: This script requires a Roll20 Pro subscription to use custom API scripts and token markers.
- **DnD20Play Improved Height Markers**: This premade marker set is needed for the script to work.
- ***Custom Token Markers**: You can create custom token markers with specific naming conventions (see below).*

## Custom Token Marker Setup

### Positive Heights (Above Ground)

Create custom token markers named in the following format:

- `Height Marker Pink 5 ft`
- `Height Marker Pink 10 ft`
- `Height Marker Pink 15 ft`
- ...
- Up to `Height Marker Pink 300 ft`

### Negative Heights (Below Ground)

Create custom token markers named in the following format:

- `Height Marker Black 5 feet`
- `Height Marker Black 10 feet`
- `Height Marker Black 15 feet`
- ...
- Up to `Height Marker Black 300 feet`

**Note**: Ensure that the marker names match exactly, including spaces and units (`ft` for positive heights and `feet` for negative heights).

## Installation

1. **Copy the Script**: Copy the script code from `height-marker-script.js` in this repository.
2. **Open Roll20 API Scripts**: In your Roll20 game, navigate to the **API Scripts** section (requires Pro subscription).
3. **Create a New Script**: Click on **New Script** and give it a name, e.g., `HeightMarker`.
4. **Paste the Code**: Paste the script code into the script editor.
5. **Save the Script**: Click **Save Script** to apply the changes.

## Usage

1. **Select Token(s)**: On the game board, select one or more tokens you wish to assign a height marker to.
2. **Enter Command**: In the chat window, type one of the following commands followed by a height value:

   - `!h [height]`
   - `!height [height]`

   **Examples**:

   - `!h 25` assigns the "Height Marker Pink 25 ft" marker.
   - `!h -15` assigns the "Height Marker Black 15 feet" marker.
   - `!h 0` removes any existing height markers from the selected tokens.

3. **Constraints**:

   - **Height Value**: Must be a number divisible by 5 (e.g., -300, -295, ..., 0, 5, ..., 300).
   - **Height Range**: The valid range is from **-300** to **300**.
   - **Token Selection**: You must have at least one token selected when issuing the command.

4. **Feedback**:

   - If you enter an invalid height or do not have a token selected, the script will send a whisper message indicating the issue.

## Notes

- **Player Names**: The script handles player names with or without the "(GM)" suffix when sending whisper messages.
- **Case Sensitivity**: The script is case-insensitive regarding the command (`!h` or `!height`) and marker names.
- **Customization**:
  - You can adjust the height range or increments by modifying the script.
  - If you change the naming convention of the token markers, ensure the script is updated accordingly.
