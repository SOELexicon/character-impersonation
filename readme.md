# Character Impersonation Extension for SillyTavern

This extension allows you to use your currently configured LLM to impersonate your character and generate responses based on chat history and custom system prompts.

## Features

- **Character Impersonation**: Generate responses as your current character using the configured LLM
- **Custom System Prompts**: Set custom instructions for how the character should behave
- **Chat History Integration**: Includes recent chat history for context
- **Flexible Commands**: Multiple slash commands for different use cases
- **Settings Panel**: Easy-to-use configuration interface

## Installation

### Method 1: Direct Installation (Recommended)

1. Open SillyTavern and navigate to Extensions panel (stacked blocks icon)
2. Click "Install extension" 
3. Enter this repository URL: `https://github.com/yourusername/character-impersonation-extension`
4. Click Install

### Method 2: Manual Installation

1. Navigate to your SillyTavern installation directory
2. Go to `data/default-user/extensions` (or your user folder if different)
3. Create a new folder called `character-impersonation`
4. Copy the following files into this folder:
   - `manifest.json`
   - `index.js`
   - `style.css`
5. Restart SillyTavern

## Usage

### Basic Commands

#### `/roleplay` (alias: `/rp`)
Generate a response as your current character.

**Examples:**
```
/roleplay What do you think about the weather today?
/rp Hello there!
/roleplay prompt="Be more cheerful than usual" How are you feeling?
```

#### `/setimprompt` (alias: `/setprompt`)
Set or view the custom system prompt for impersonation.

**Examples:**
```
/setimprompt
/setimprompt You are feeling very happy today and respond enthusiastically to everything.
```

### User Interface

#### Floating Button
- A floating "Roleplay" button appears in the bottom-right corner when a character is loaded
- Click it to open the roleplay modal

#### Modal Dialog
- **Situation/Message**: Enter what you want the character to respond to
- **Custom Instructions**: Optional temporary instructions (e.g., "be more cheerful")
- **Current System Prompt**: Shows the active prompt that will be used
- **Generate Response**: Creates the response and optionally adds it to chat

#### Integration with Chat Options
- The extension attempts to add a "Roleplay as [Character]" button to message menus
- Look for it in message edit menus or chat options panels

### Configuration

1. Open the Extensions panel in SillyTavern
2. Scroll down to find "Character Impersonation Settings"
3. Configure the following options:
   - **Enable Character Impersonation**: Toggle the extension on/off
   - **Include Character Card Information**: Whether to include character description, personality, etc.
   - **Max History Messages**: Number of recent messages to include for context (1-50)
   - **Default System Prompt**: The base instruction prompt for impersonation
   - **Custom System Prompt**: Override the default prompt with your own

### Default System Prompt

The extension comes with a sensible default prompt:

```
You are now roleplaying as {{char}}. Respond to the following conversation as {{char}} would, maintaining their personality, speech patterns, and behavior. Consider the chat history for context.
```

You can customize this in the settings panel or use the `/setimprompt` command.

### Prompt Variables

The following variables are automatically replaced in system prompts:
- `{{char}}` - Current character's name
- `{{user}}` - User's name

## How It Works

1. **Character Detection**: The extension automatically detects your currently selected character
2. **Context Building**: It gathers recent chat history and character information
3. **Prompt Construction**: Combines the system prompt, character info, and chat history
4. **LLM Generation**: Uses SillyTavern's `generateQuietPrompt()` to get a response from your configured LLM
5. **Response Display**: Shows the generated response and optionally inserts it into the chat

## Requirements

- SillyTavern (latest version recommended)
- A configured LLM connection (any API supported by SillyTavern)
- A selected character

## Troubleshooting

### Extension is Greyed Out / Can't Be Enabled

If the extension appears in the Extensions panel but is greyed out and can't be enabled:

1. **Check the Browser Console**: 
   - Open Developer Tools (F12)
   - Look at the Console tab for any error messages starting with `[Character Impersonation]`
   - Common errors and solutions:

2. **Check File Structure**:
   ```
   data/default-user/extensions/character-impersonation/
   ├── manifest.json
   ├── index.js
   ├── style.css
   └── README.md
   ```

3. **Verify Extensions are Enabled**:
   - Make sure `enableExtensions = true` in your SillyTavern `config.conf` file
   - Restart SillyTavern after making this change

4. **Check SillyTavern Version**:
   - This extension requires a recent version of SillyTavern
   - Update to the latest release or staging branch

5. **Manual Diagnostics**:
   - Open the browser console and type: `typeof SillyTavern`
   - It should return `"object"` - if it returns `"undefined"`, SillyTavern hasn't loaded properly

6. **Try Reloading**:
   - Refresh the SillyTavern page
   - Check if the extension becomes available after a full page reload

### Extension is Enabled but Nothing Happens

If the extension is enabled but you don't see slash commands or the settings panel:

1. **Run the Test Function**:
   - Open browser console (F12)
   - Type: `testCharacterImpersonation()`
   - This will show what's working and what isn't

2. **Check Console Logs**:
   - Look for messages starting with `[Character Impersonation]`
   - The extension logs its initialization progress

3. **Test slash commands**:
   - Try typing `/help slash` in SillyTavern chat to see all available commands
   - Look for `/roleplay` in the list
   - If it's not there, the command registration failed

4. **Check Settings Panel**:
   - The settings may take up to 20 seconds to appear
   - Look in the Extensions panel for "Character Impersonation Settings"
   - If it doesn't appear, check console for UI initialization errors

5. **Manual Command Test**:
   - Try typing `/roleplay Hello` in chat
   - Check console for any error messages

6. **Check UI Elements**:
   - Look for a floating "Roleplay" button in the bottom-right corner
   - It should appear when you have a character loaded

### Common Issues and Solutions

**"SillyTavern context not available"**
- Wait a few seconds for SillyTavern to fully load
- Refresh the page and try again

**"generateQuietPrompt function not available"**
- Your SillyTavern version might be too old
- Update to the latest version

**"No character selected"**
- Load a character before using the extension
- The extension needs an active character to work

**Settings panel not appearing**
- Check console for `Settings panel search attempt` messages
- Try refreshing the Extensions panel

### Debug Commands

You can use these commands in the browser console for debugging:

```javascript
// Test the extension
testCharacterImpersonation()

// Test the modal dialog
showImpersonationModal()

// Update UI elements
updateUIElements()

// Check if SillyTavern is available
typeof SillyTavern

// Check specific functions
typeof generateQuietPrompt
typeof registerSlashCommand

// Check extension status
SillyTavern.getContext().extensionSettings.character_impersonation
```

### "No character selected" Error
- Make sure you have a character loaded in your current chat
- The extension requires an active character to impersonate

### No Response Generated
- Check that your LLM API is working properly in SillyTavern
- Verify your API connection and settings
- Try with a simpler prompt

### Extension Not Loading
- Ensure `enableExtensions` is set to `true` in your SillyTavern `config.conf`
- Check the browser console for any error messages
- Verify all files are in the correct directory structure

### Settings Panel Not Appearing
- The settings may take a few seconds to appear after enabling the extension
- Try refreshing the Extensions panel
- Check the console for any UI-related errors

## Advanced Usage

### Custom Prompts for Specific Situations

You can create different prompts for different scenarios:

```
/roleplay prompt="You are in a formal meeting and need to be professional" What's your opinion on the proposal?

/roleplay prompt="You're feeling playful and mischievous today" *looks around the room*

/roleplay prompt="Respond as if you're tired and want to go to sleep" Good morning!
```

### Integration with STScript

The extension commands can be used in STScript for automation:

```
/roleplay {{getvar::user_message}} | /echo {{pipe}}
```

### Modal Dialog Usage

The modal provides a more user-friendly interface:

1. Click the floating "Roleplay" button or find it in chat menus
2. Enter the situation or message in the text area
3. Optionally add custom instructions
4. Click "Generate Response"
5. Choose whether to insert the response into the chat

## Contributing

This extension is open-source. Feel free to:
- Report bugs and issues
- Suggest new features
- Submit pull requests
- Fork and modify for your needs

## License

This extension is released under the AGPL-3.0 license, compatible with SillyTavern's licensing requirements.

## Support

If you encounter issues or need help:
1. Check the troubleshooting section above
2. Review the SillyTavern console for error messages
3. Create an issue on the GitHub repository with detailed information about your problem

## Changelog

### Version 1.0.0
- Initial release
- Basic character impersonation functionality
- Configurable system prompts
- Chat history integration
- Settings panel
- Slash command support