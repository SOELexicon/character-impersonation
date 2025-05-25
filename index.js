import { generateQuietPrompt } from "../../../../script.js";
import { SlashCommandParser } from "../../../../app/slash-commands/SlashCommandParser.js";
import { SlashCommand } from "../../../../app/slash-commands/SlashCommand.js";
import { ARGUMENT_TYPE, SlashCommandArgument } from "../../../../app/slash-commands/SlashCommandArgument.js";
import { callPopup, showLoader, hideLoader } from "../../../../script.js";

// Extension module name
const MODULE_NAME = 'character_impersonation';

// Default settings
const defaultSettings = {
    enabled: true,
    defaultSystemPrompt: "You are now roleplaying as {{char}}. Respond to the following conversation as {{char}} would, maintaining their personality, speech patterns, and behavior. Consider the chat history for context.",
    includeCharacterCard: true,
    maxHistoryMessages: 10,
    customSystemPrompt: ""
};

// Extension settings
let extensionSettings = {};

// Get SillyTavern context
function getContext() {
    return SillyTavern.getContext();
}

// Initialize extension settings
function initSettings() {
    const context = getContext();
    if (!context.extensionSettings[MODULE_NAME]) {
        context.extensionSettings[MODULE_NAME] = Object.assign({}, defaultSettings);
    }
    extensionSettings = context.extensionSettings[MODULE_NAME];
    context.saveSettingsDebounced();
}

// Save settings
function saveSettings() {
    const context = getContext();
    context.extensionSettings[MODULE_NAME] = extensionSettings;
    context.saveSettingsDebounced();
}

// Get character information
function getCurrentCharacterInfo() {
    const context = getContext();
    if (context.characterId === undefined || context.characterId === null) {
        return null;
    }
    
    const character = context.characters[context.characterId];
    if (!character) {
        return null;
    }
    
    return {
        name: character.name || 'Unknown',
        description: character.description || '',
        personality: character.personality || '',
        scenario: character.scenario || '',
        first_mes: character.first_mes || '',
        mes_example: character.mes_example || ''
    };
}

// Get recent chat history
function getChatHistory(maxMessages = 10) {
    const context = getContext();
    if (!context.chat || context.chat.length === 0) {
        return [];
    }
    
    // Get the last N messages, excluding system messages
    const recentMessages = context.chat
        .filter(msg => !msg.is_system && !msg.is_user_mes === undefined) // Include both user and character messages
        .slice(-maxMessages)
        .map(msg => ({
            name: msg.name || (msg.is_user ? context.name1 || 'User' : 'Character'),
            message: msg.mes || '',
            is_user: msg.is_user || false
        }));
    
    return recentMessages;
}

// Format chat history for prompt
function formatChatHistory(messages) {
    if (!messages || messages.length === 0) {
        return "No previous messages in this conversation.";
    }
    
    let formatted = "Recent conversation history:\n";
    messages.forEach(msg => {
        formatted += `${msg.name}: ${msg.message}\n`;
    });
    
    return formatted;
}

// Build the system prompt
function buildSystemPrompt(customPrompt = null) {
    const character = getCurrentCharacterInfo();
    if (!character) {
        throw new Error("No character selected. Please select a character first.");
    }
    
    let systemPrompt = customPrompt || extensionSettings.customSystemPrompt || extensionSettings.defaultSystemPrompt;
    
    // Replace character placeholders
    systemPrompt = systemPrompt
        .replace(/\{\{char\}\}/g, character.name)
        .replace(/\{\{user\}\}/g, getContext().name1 || 'User');
    
    if (extensionSettings.includeCharacterCard) {
        systemPrompt += "\n\nCharacter Information:\n";
        systemPrompt += `Name: ${character.name}\n`;
        if (character.description) systemPrompt += `Description: ${character.description}\n`;
        if (character.personality) systemPrompt += `Personality: ${character.personality}\n`;
        if (character.scenario) systemPrompt += `Scenario: ${character.scenario}\n`;
        if (character.mes_example) systemPrompt += `Example dialogue: ${character.mes_example}\n`;
    }
    
    return systemPrompt;
}

// Main impersonation function
async function impersonateCharacter(input, customPrompt = null) {
    try {
        showLoader();
        
        const character = getCurrentCharacterInfo();
        if (!character) {
            throw new Error("No character selected. Please select a character first.");
        }
        
        // Build the system prompt
        const systemPrompt = buildSystemPrompt(customPrompt);
        
        // Get chat history
        const chatHistory = getChatHistory(extensionSettings.maxHistoryMessages);
        const formattedHistory = formatChatHistory(chatHistory);
        
        // Build the full prompt
        let fullPrompt = systemPrompt + "\n\n" + formattedHistory;
        
        if (input && input.trim()) {
            fullPrompt += `\n\nLatest message to respond to: ${input}`;
        }
        
        fullPrompt += `\n\nRespond as ${character.name}:`;
        
        // Generate response using SillyTavern's current LLM
        const response = await generateQuietPrompt(fullPrompt);
        
        hideLoader();
        
        if (response && response.trim()) {
            // Display the response in a popup or insert it into chat
            const shouldInsertToChat = await callPopup(
                `<h3>${character.name} (Impersonated) says:</h3><br><div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">${response}</div><br>Would you like to insert this response into the chat?`,
                'confirm'
            );
            
            if (shouldInsertToChat) {
                // Insert as character message
                const context = getContext();
                const newMessage = {
                    name: character.name,
                    is_user: false,
                    is_name: true,
                    mes: response,
                    send_date: new Date().toISOString(),
                    extra: {
                        impersonated: true
                    }
                };
                
                context.chat.push(newMessage);
                context.saveChat();
                
                // Refresh the chat display
                if (typeof context.printMessages === 'function') {
                    context.printMessages();
                } else if (typeof printMessages === 'function') {
                    printMessages();
                }
            }
            
            return response;
        } else {
            throw new Error("No response generated from the LLM.");
        }
        
    } catch (error) {
        hideLoader();
        console.error('[Character Impersonation] Error:', error);
        callPopup(`Error during character impersonation: ${error.message}`, 'text');
        throw error;
    }
}

// Create settings UI
function createSettingsHTML() {
    return `
        <div class="character-impersonation-settings">
            <h3>Character Impersonation Settings</h3>
            
            <label for="ci_enabled">
                <input type="checkbox" id="ci_enabled" ${extensionSettings.enabled ? 'checked' : ''}>
                Enable Character Impersonation
            </label>
            
            <label for="ci_include_card">
                <input type="checkbox" id="ci_include_card" ${extensionSettings.includeCharacterCard ? 'checked' : ''}>
                Include Character Card Information
            </label>
            
            <label for="ci_max_history">
                Max History Messages:
                <input type="number" id="ci_max_history" value="${extensionSettings.maxHistoryMessages}" min="1" max="50" style="width: 60px;">
            </label>
            
            <label for="ci_system_prompt">
                Default System Prompt:
                <textarea id="ci_system_prompt" rows="4" style="width: 100%; margin-top: 5px;">${extensionSettings.defaultSystemPrompt}</textarea>
            </label>
            
            <label for="ci_custom_prompt">
                Custom System Prompt (leave empty to use default):
                <textarea id="ci_custom_prompt" rows="3" style="width: 100%; margin-top: 5px;">${extensionSettings.customSystemPrompt}</textarea>
            </label>
            
            <div style="margin-top: 10px;">
                <button id="ci_save_settings" class="menu_button">Save Settings</button>
                <button id="ci_reset_settings" class="menu_button">Reset to Defaults</button>
            </div>
        </div>
    `;
}

// Initialize settings UI
function initSettingsUI() {
    const settingsHtml = createSettingsHTML();
    $('#extensions_settings2').append(settingsHtml);
    
    // Bind event handlers
    $('#ci_save_settings').on('click', function() {
        extensionSettings.enabled = $('#ci_enabled').prop('checked');
        extensionSettings.includeCharacterCard = $('#ci_include_card').prop('checked');
        extensionSettings.maxHistoryMessages = parseInt($('#ci_max_history').val()) || 10;
        extensionSettings.defaultSystemPrompt = $('#ci_system_prompt').val();
        extensionSettings.customSystemPrompt = $('#ci_custom_prompt').val();
        
        saveSettings();
        callPopup('Character Impersonation settings saved!', 'text');
    });
    
    $('#ci_reset_settings').on('click', function() {
        if (confirm('Reset all settings to defaults?')) {
            Object.assign(extensionSettings, defaultSettings);
            $('#ci_enabled').prop('checked', extensionSettings.enabled);
            $('#ci_include_card').prop('checked', extensionSettings.includeCharacterCard);
            $('#ci_max_history').val(extensionSettings.maxHistoryMessages);
            $('#ci_system_prompt').val(extensionSettings.defaultSystemPrompt);
            $('#ci_custom_prompt').val(extensionSettings.customSystemPrompt);
            
            saveSettings();
            callPopup('Settings reset to defaults!', 'text');
        }
    });
}

// Register slash commands
function registerSlashCommands() {
    // Main impersonation command
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'impersonate',
        aliases: ['imp', 'roleplay'],
        callback: async (namedArgs, unnamedArgs) => {
            if (!extensionSettings.enabled) {
                return "Character Impersonation extension is disabled. Enable it in the extension settings.";
            }
            
            const input = unnamedArgs.toString().trim();
            const customPrompt = namedArgs.prompt || null;
            
            try {
                const response = await impersonateCharacter(input, customPrompt);
                return `Impersonation complete. Response generated as ${getCurrentCharacterInfo()?.name || 'character'}.`;
            } catch (error) {
                return `Error: ${error.message}`;
            }
        },
        namedArgumentList: [
            SlashCommandArgument.fromProps({
                name: 'prompt',
                description: 'Custom system prompt to use instead of the default',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: '',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The message or situation to respond to (optional)',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: `
            <div>
                <div>Makes the current character respond to a message or situation using the configured LLM.</div>
                <div>
                    <strong>Usage:</strong>
                    <ul>
                        <li><pre><code>/impersonate What do you think about the weather?</code></pre></li>
                        <li><pre><code>/impersonate prompt="Be more cheerful than usual" How are you feeling?</code></pre></li>
                        <li><pre><code>/imp</code></pre> (generates a response based on recent chat history)</li>
                    </ul>
                </div>
                <div><strong>Note:</strong> Requires a character to be selected and the extension to be enabled.</div>
            </div>
        `,
        returns: 'completion message'
    }));
    
    // Command to set custom system prompt
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setimprompt',
        aliases: ['setprompt'],
        callback: (namedArgs, unnamedArgs) => {
            const newPrompt = unnamedArgs.toString().trim();
            if (!newPrompt) {
                return `Current custom system prompt: ${extensionSettings.customSystemPrompt || '(none - using default)'}`;
            }
            
            extensionSettings.customSystemPrompt = newPrompt;
            saveSettings();
            return `Custom system prompt updated: ${newPrompt}`;
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The new custom system prompt to use for impersonation',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
        ],
        helpString: `
            <div>
                <div>Sets or views the custom system prompt for character impersonation.</div>
                <div>
                    <strong>Usage:</strong>
                    <ul>
                        <li><pre><code>/setimprompt</code></pre> (view current prompt)</li>
                        <li><pre><code>/setimprompt You are feeling very happy today and respond enthusiastically to everything.</code></pre></li>
                    </ul>
                </div>
            </div>
        `,
        returns: 'confirmation message'
    }));
}

// Extension initialization
async function init() {
    console.log('[Character Impersonation] Initializing extension...');
    
    // Initialize settings
    initSettings();
    
    // Register slash commands
    registerSlashCommands();
    
    // Initialize settings UI when extensions panel loads
    $(document).ready(() => {
        setTimeout(() => {
            initSettingsUI();
        }, 1000);
    });
    
    console.log('[Character Impersonation] Extension initialized successfully!');
}

// Start the extension
init();