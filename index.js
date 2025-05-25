// Import functions from SillyTavern
import { generateQuietPrompt, callPopup, showLoader, hideLoader, printMessages } from "../../../../script.js";

// Extension module name
const MODULE_NAME = 'character_impersonation';

// Extension diagnostic function
function runDiagnostics() {
    const diagnostics = {
        sillyTavernContext: typeof SillyTavern !== 'undefined' && SillyTavern.getContext,
        generateQuietPrompt: typeof generateQuietPrompt === 'function',
        jQuery: typeof $ !== 'undefined',
        registerSlashCommand: typeof registerSlashCommand === 'function',
        callPopup: typeof callPopup === 'function',
        showLoader: typeof showLoader === 'function',
        hideLoader: typeof hideLoader === 'function'
    };
    
    console.log('[Character Impersonation] Diagnostics:', diagnostics);
    return diagnostics;
}

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
                
                // Try multiple methods to refresh the chat display
                try {
                    if (typeof printMessages === 'function') {
                        printMessages();
                    } else if (context.printMessages && typeof context.printMessages === 'function') {
                        context.printMessages();
                    } else {
                        // Fallback: trigger a chat refresh event
                        $(document).trigger('chatLoaded');
                    }
                } catch (refreshError) {
                    console.warn('[Character Impersonation] Could not refresh chat display:', refreshError);
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
    // Wait for the extensions settings panel to be available
    const checkForSettingsPanel = () => {
        // Try multiple possible locations for the settings panel
        let settingsPanel = $('#extensions_settings2');
        if (settingsPanel.length === 0) {
            settingsPanel = $('#extensions_settings');
        }
        if (settingsPanel.length === 0) {
            settingsPanel = $('.extensions_settings');
        }
        
        if (settingsPanel.length > 0) {
            try {
                const settingsHtml = createSettingsHTML();
                settingsPanel.append(settingsHtml);
                
                // Bind event handlers with error handling
                $('#ci_save_settings').on('click', function() {
                    try {
                        extensionSettings.enabled = $('#ci_enabled').prop('checked');
                        extensionSettings.includeCharacterCard = $('#ci_include_card').prop('checked');
                        extensionSettings.maxHistoryMessages = parseInt($('#ci_max_history').val()) || 10;
                        extensionSettings.defaultSystemPrompt = $('#ci_system_prompt').val();
                        extensionSettings.customSystemPrompt = $('#ci_custom_prompt').val();
                        
                        saveSettings();
                        
                        // Use a simple alert if callPopup is not available
                        if (typeof callPopup === 'function') {
                            callPopup('Character Impersonation settings saved!', 'text');
                        } else {
                            alert('Character Impersonation settings saved!');
                        }
                    } catch (error) {
                        console.error('[Character Impersonation] Error saving settings:', error);
                        alert('Error saving settings: ' + error.message);
                    }
                });
                
                $('#ci_reset_settings').on('click', function() {
                    if (confirm('Reset all settings to defaults?')) {
                        try {
                            Object.assign(extensionSettings, defaultSettings);
                            $('#ci_enabled').prop('checked', extensionSettings.enabled);
                            $('#ci_include_card').prop('checked', extensionSettings.includeCharacterCard);
                            $('#ci_max_history').val(extensionSettings.maxHistoryMessages);
                            $('#ci_system_prompt').val(extensionSettings.defaultSystemPrompt);
                            $('#ci_custom_prompt').val(extensionSettings.customSystemPrompt);
                            
                            saveSettings();
                            
                            if (typeof callPopup === 'function') {
                                callPopup('Settings reset to defaults!', 'text');
                            } else {
                                alert('Settings reset to defaults!');
                            }
                        } catch (error) {
                            console.error('[Character Impersonation] Error resetting settings:', error);
                            alert('Error resetting settings: ' + error.message);
                        }
                    }
                });
                
                console.log('[Character Impersonation] Settings UI initialized');
            } catch (error) {
                console.error('[Character Impersonation] Error creating settings UI:', error);
            }
        } else {
            // Retry after a short delay if no settings panel found
            setTimeout(checkForSettingsPanel, 1000);
        }
    };
    
    // Start checking for the settings panel
    if (typeof $ !== 'undefined') {
        checkForSettingsPanel();
    } else {
        console.warn('[Character Impersonation] jQuery not available, settings UI will not be initialized');
    }
}

// Register slash commands using the legacy method for better compatibility
function registerSlashCommands() {
    // Check if registerSlashCommand is available (legacy method)
    if (typeof registerSlashCommand === 'function') {
        // Main impersonation command
        registerSlashCommand('impersonate', async (args, value) => {
            if (!extensionSettings.enabled) {
                return "Character Impersonation extension is disabled. Enable it in the extension settings.";
            }
            
            try {
                // Parse arguments - simple approach
                let customPrompt = null;
                let input = value || '';
                
                // Check for prompt= parameter
                if (args && args.prompt) {
                    customPrompt = args.prompt;
                }
                
                const response = await impersonateCharacter(input, customPrompt);
                return `Impersonation complete. Response generated as ${getCurrentCharacterInfo()?.name || 'character'}.`;
            } catch (error) {
                console.error('[Character Impersonation] Error:', error);
                return `Error: ${error.message}`;
            }
        }, ['imp', 'roleplay'], '<span class="monospace">prompt=(custom system prompt)</span> (message) – Generate a response as your current character', true, true);
        
        // Command to set custom system prompt
        registerSlashCommand('setimprompt', (args, value) => {
            const newPrompt = value?.trim();
            if (!newPrompt) {
                return `Current custom system prompt: ${extensionSettings.customSystemPrompt || '(none - using default)'}`;
            }
            
            extensionSettings.customSystemPrompt = newPrompt;
            saveSettings();
            return `Custom system prompt updated: ${newPrompt}`;
        }, ['setprompt'], '(new prompt) – Set or view the custom system prompt for impersonation', true, true);
        
        console.log('[Character Impersonation] Slash commands registered successfully using legacy method');
    } else {
        console.warn('[Character Impersonation] registerSlashCommand not available, commands not registered');
    }
}

// Extension initialization
function init() {
    try {
        console.log('[Character Impersonation] Starting extension initialization...');
        
        // Run diagnostics to check available functions
        const diagnostics = runDiagnostics();
        
        // Check if we have access to SillyTavern context
        if (!diagnostics.sillyTavernContext) {
            throw new Error('SillyTavern context not available');
        }
        
        // Initialize settings
        initSettings();
        console.log('[Character Impersonation] Settings initialized');
        
        // Register slash commands
        registerSlashCommands();
        
        // Initialize settings UI when ready
        if (diagnostics.jQuery) {
            // Use multiple methods to ensure UI initialization
            $(document).ready(() => {
                setTimeout(() => {
                    initSettingsUI();
                }, 1000);
            });
            
            // Also try when extensions are loaded
            $(document).on('extensionsReady', () => {
                setTimeout(() => {
                    initSettingsUI();
                }, 500);
            });
        } else {
            // Fallback if jQuery is not available
            setTimeout(() => {
                initSettingsUI();
            }, 2000);
        }
        
        console.log('[Character Impersonation] Extension initialized successfully!');
        return true;
        
    } catch (error) {
        console.error('[Character Impersonation] Failed to initialize extension:', error);
        // Don't throw the error to prevent the extension from being disabled
        return false;
    }
}

// Start the extension with error handling
try {
    init();
} catch (error) {
    console.error('[Character Impersonation] Critical error during extension startup:', error);
}