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

#### `/impersonate` (aliases: `/imp`, `/roleplay`)
Generate a response as your current character.

**Examples:**
```
/impersonate What do you think about the weather today?
/imp
/roleplay prompt="Be more cheerful than usual" How are you feeling?
```

#### `/setimprompt` (alias: `/setprompt`)
Set or view the custom system prompt for impersonation.

**Examples:**
```
/setimprompt
/setimprompt You are feeling very happy today and respond enthusiastically to everything.
```

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

## Advanced Usage

### Custom Prompts for Specific Situations

You can create different prompts for different scenarios:

```
/impersonate prompt="You are in a formal meeting and need to be professional" What's your opinion on the proposal?

/impersonate prompt="You're feeling playful and mischievous today" *looks around the room*

/impersonate prompt="Respond as if you're tired and want to go to sleep" Good morning!
```

### Integration with STScript

The extension commands can be used in STScript for automation:

```
/impersonate {{getvar::user_message}} | /echo {{pipe}}
```

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