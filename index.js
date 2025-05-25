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
        // Use fallback if showLoader isn't available
        if (typeof showLoader === 'function') {
            showLoader();
        }
        
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
        let response;
        if (typeof generateQuietPrompt === 'function') {
            response = await generateQuietPrompt(fullPrompt);
        } else {
            throw new Error("generateQuietPrompt function not available. Make sure you're using a compatible version of SillyTavern.");
        }
        
        // Use fallback if hideLoader isn't available
        if (typeof hideLoader === 'function') {
            hideLoader();
        }
        
        if (response && response.trim()) {
            // Display the response in a popup or insert it into chat
            let shouldInsertToChat = false;
            
            if (typeof callPopup === 'function') {
                shouldInsertToChat = await callPopup(
                    `<h3>${character.name} (Impersonated) says:</h3><br><div style="background: #f0f0f0; padding: 10px; border-radius: 5px; margin: 10px 0;">${response}</div><br>Would you like to insert this response into the chat?`,
                    'confirm'
                );
            } else {
                // Fallback to native browser confirm
                shouldInsertToChat = confirm(`${character.name} (Impersonated) says:\n\n${response}\n\nWould you like to insert this response into the chat?`);
            }
            
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
                
                // Try to save the chat
                if (typeof context.saveChat === 'function') {
                    context.saveChat();
                }
                
                // Try multiple methods to refresh the chat display
                try {
                    if (typeof printMessages === 'function') {
                        printMessages();
                    } else if (context.printMessages && typeof context.printMessages === 'function') {
                        context.printMessages();
                    } else if (typeof $ !== 'undefined') {
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
        // Use fallback if hideLoader isn't available
        if (typeof hideLoader === 'function') {
            hideLoader();
        }
        
        console.error('[Character Impersonation] Error:', error);
        
        // Use fallback for error display
        if (typeof callPopup === 'function') {
            callPopup(`Error during character impersonation: ${error.message}`, 'text');
        } else {
            alert(`Error during character impersonation: ${error.message}`);
        }
        
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
    console.log('[Character Impersonation] Attempting to initialize settings UI...');
    
    // Wait for the extensions settings panel to be available
    const checkForSettingsPanel = (attempts = 0) => {
        const maxAttempts = 20; // Try for up to 20 seconds
        
        // Try multiple possible locations for the settings panel
        let settingsPanel = $('#extensions_settings2');
        if (settingsPanel.length === 0) {
            settingsPanel = $('#extensions_settings');
        }
        if (settingsPanel.length === 0) {
            settingsPanel = $('.extensions_settings');
        }
        if (settingsPanel.length === 0) {
            settingsPanel = $('#extensions_settings_panel');
        }
        
        console.log(`[Character Impersonation] Settings panel search attempt ${attempts + 1}, found: ${settingsPanel.length} panels`);
        
        if (settingsPanel.length > 0) {
            try {
                // Check if our settings are already added
                if ($('.character-impersonation-settings').length > 0) {
                    console.log('[Character Impersonation] Settings UI already exists, skipping initialization');
                    return;
                }
                
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
                
                console.log('[Character Impersonation] Settings UI initialized successfully');
            } catch (error) {
                console.error('[Character Impersonation] Error creating settings UI:', error);
            }
        } else if (attempts < maxAttempts) {
            // Retry after a short delay if no settings panel found
            setTimeout(() => checkForSettingsPanel(attempts + 1), 1000);
        } else {
            console.warn('[Character Impersonation] Could not find settings panel after', maxAttempts, 'attempts. Settings UI will not be available.');
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
        try {
            initSettings();
            console.log('[Character Impersonation] Settings initialized successfully');
        } catch (settingsError) {
            console.error('[Character Impersonation] Failed to initialize settings:', settingsError);
            // Continue anyway, maybe we can still register commands
        }
        
        // Register slash commands
        try {
            registerSlashCommands();
            console.log('[Character Impersonation] Slash commands registration attempted');
        } catch (commandError) {
            console.error('[Character Impersonation] Failed to register slash commands:', commandError);
        }
        
        // Initialize settings UI when ready
        if (diagnostics.jQuery) {
            console.log('[Character Impersonation] jQuery available, setting up UI initialization...');
            
            // Try immediate initialization
            setTimeout(() => {
                initSettingsUI();
            }, 500);
            
            // Use multiple methods to ensure UI initialization
            $(document).ready(() => {
                console.log('[Character Impersonation] Document ready, attempting UI init...');
                setTimeout(() => {
                    initSettingsUI();
                }, 1000);
            });
            
            // Also try when extensions are loaded
            $(document).on('extensionsReady', () => {
                console.log('[Character Impersonation] Extensions ready event, attempting UI init...');
                setTimeout(() => {
                    initSettingsUI();
                }, 500);
            });
            
            // Additional event listeners for various extension loading events
            $(document).on('extensionsLoaded', () => {
                console.log('[Character Impersonation] Extensions loaded event, attempting UI init...');
                setTimeout(() => {
                    initSettingsUI();
                }, 500);
            });
            
        } else {
            console.warn('[Character Impersonation] jQuery not available, using fallback UI initialization');
            // Fallback if jQuery is not available
            setTimeout(() => {
                initSettingsUI();
            }, 2000);
        }
        
        console.log('[Character Impersonation] Extension initialization completed!');
        console.log('[Character Impersonation] Available commands: /impersonate, /imp, /roleplay, /setimprompt, /setprompt');
        
        return true;
        
    } catch (error) {
        console.error('[Character Impersonation] Failed to initialize extension:', error);
        // Don't throw the error to prevent the extension from being disabled
        return false;
    }
}

// Make sure the extension starts after SillyTavern is ready
function waitForSillyTavern() {
    if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) {
        console.log('[Character Impersonation] SillyTavern detected, starting extension...');
        init();
    } else {
        console.log('[Character Impersonation] Waiting for SillyTavern...');
        setTimeout(waitForSillyTavern, 100);
    }
}

// Test function for debugging (can be called from console)
window.testCharacterImpersonation = function() {
    console.log('[Character Impersonation] Running diagnostic test...');
    
    const diagnostics = runDiagnostics();
    console.log('Diagnostics:', diagnostics);
    
    try {
        const context = getContext();
        console.log('SillyTavern context:', context);
        
        const character = getCurrentCharacterInfo();
        console.log('Current character:', character);
        
        console.log('Extension settings:', extensionSettings);
        
        const chatHistory = getChatHistory(5);
        console.log('Recent chat history:', chatHistory);
        
        console.log('[Character Impersonation] Test completed successfully');
        return true;
    } catch (error) {
        console.error('[Character Impersonation] Test failed:', error);
        return false;
    }
};

// Start the extension with error handling
try {
    waitForSillyTavern();
} catch (error) {
    console.error('[Character Impersonation] Critical error during extension startup:', error);
}