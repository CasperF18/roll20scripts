# Roll20 Custom Buffs Script

## Description

This Roll20 script is designed to manage custom buffs in Dungeons & Dragons 5th Edition games. It provides functionality to toggle buffs like Bladesong, Longstrider, and Blur, automatically adjusting character attributes and providing chat notifications about buff status. 

## Usage

- **Activating a Buff**:
  - Use the command `!toggleBuffName` where `BuffName` is the name of the buff (e.g., `!toggleBladesong`).
  - The script will activate the buff and adjust relevant character attributes.

- **Deactivating a Buff**:
  - Buffs will automatically deactivate after their set duration based on the turn tracker.
  - You can also manually deactivate a buff using the same toggle command.

- **Chat Notifications**:
  - The script will notify players in the chat when buffs are activated or deactivated and when attribute changes occur.

## Customization

- You can customize buff durations and effects by modifying the script.
