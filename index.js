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

// Create and show impersonation modal
function showImpersonationModal() {
    if (!extensionSettings.enabled) {
        alert("Character Impersonation extension is disabled. Enable it in the extension settings.");
        return;
    }
    
    const character = getCurrentCharacterInfo();
    if (!character) {
        alert("No character selected. Please select a character first.");
        return;
    }
    
    const modalHtml = `
        <div id="impersonation_modal" class="modal-bg">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3>Character Roleplay - ${character.name}</h3>
                    <span class="modal-close" onclick="$('#impersonation_modal').remove();">&times;</span>
                </div>
                <div class="modal-body">
                    <div style="margin-bottom: 15px;">
                        <label for="imp_situation">Situation or Message to Respond To:</label>
                        <textarea id="imp_situation" rows="3" style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="Describe the situation or enter a message for ${character.name} to respond to..."></textarea>
                    </div>
                    
                    <div style="margin-bottom: 15px;">
                        <label for="imp_custom_prompt">Custom Instructions (optional):</label>
                        <textarea id="imp_custom_prompt" rows="2" style="width: 100%; margin-top: 5px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;" placeholder="e.g., Be more cheerful than usual, You're feeling tired, etc."></textarea>
                    </div>
                    
                    <div style="margin-bottom: 15px; font-size: 12px; color: #666;">
                        <strong>Current System Prompt:</strong><br>
                        <div style="background: #f5f5f5; padding: 8px; border-radius: 4px; margin-top: 5px; max-height: 100px; overflow-y: auto;">
                            ${(extensionSettings.customSystemPrompt || extensionSettings.defaultSystemPrompt).replace(/\{\{char\}\}/g, character.name)}
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button id="imp_generate_btn" class="modal-button modal-button-primary">Generate Response</button>
                    <button onclick="$('#impersonation_modal').remove();" class="modal-button">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove any existing modal
    $('#impersonation_modal').remove();
    
    // Add modal to body
    $('body').append(modalHtml);
    
    // Bind the generate button
    $('#imp_generate_btn').on('click', async function() {
        const situation = $('#imp_situation').val().trim();
        const customPrompt = $('#imp_custom_prompt').val().trim();
        
        try {
            $(this).prop('disabled', true).text('Generating...');
            
            const response = await impersonateCharacter(situation, customPrompt || null);
            
            // Close modal
            $('#impersonation_modal').remove();
            
        } catch (error) {
            console.error('[Character Impersonation] Modal error:', error);
            $(this).prop('disabled', false).text('Generate Response');
        }
    });
    
    // Close modal when clicking outside
    $('#impersonation_modal').on('click', function(e) {
        if (e.target === this) {
            $(this).remove();
        }
    });
    
    // Focus on the situation input
    setTimeout(() => {
        $('#imp_situation').focus();
    }, 100);
}

// Add option to message options menu (three dots)
function addToMessageOptionsMenu() {
    // Wait for message options to be available and hook into them
    const checkAndAddOption = () => {
        // Try to find message option menus when they appear
        $(document).off('click.character_impersonation').on('click.character_impersonation', '.mes_edit_buttons .mes_edit_cancel, .mes_edit_buttons .fa-ellipsis-h, .mes_edit_buttons .mes_edit', function(e) {
            setTimeout(() => {
                // Look for the options menu or edit menu
                const optionsMenu = $('.mes_edit_buttons .edit_textarea_buttons, .mes_edit_buttons');
                
                if (optionsMenu.length > 0 && !optionsMenu.find('.character_impersonation_option').length) {
                    const character = getCurrentCharacterInfo();
                    if (character && extensionSettings.enabled) {
                        const roleplayButton = $(`
                            <div class="character_impersonation_option" style="margin-top: 5px;">
                                <button class="menu_button" onclick="window.showImpersonationModal ? window.showImpersonationModal() : console.error('Modal function not available')" style="width: 100%;">
                                    <i class="fa fa-theater-masks"></i> Roleplay as ${character.name}
                                </button>
                            </div>
                        `);
                        optionsMenu.append(roleplayButton);
                    }
                }
            }, 100);
        });
    };
    
    // Also try to add to the chat options panel if it exists
    const addToChatOptions = () => {
        const chatOptions = $('#options_panel, .options_panel, #chat_options, .chat_options');
        if (chatOptions.length > 0 && !chatOptions.find('.character_impersonation_chat_option').length) {
            const character = getCurrentCharacterInfo();
            if (character && extensionSettings.enabled) {
                const roleplayButton = $(`
                    <div class="character_impersonation_chat_option" style="margin: 5px 0;">
                        <button class="menu_button" onclick="window.showImpersonationModal ? window.showImpersonationModal() : console.error('Modal function not available')" style="width: 100%;">
                            <i class="fa fa-theater-masks"></i> Roleplay as ${character.name}
                        </button>
                    </div>
                `);
                chatOptions.append(roleplayButton);
            }
        }
    };
    
    // Try to add to various possible menu locations
    checkAndAddOption();
    addToChatOptions();
    
    // Also check periodically for new menus
    setInterval(() => {
        addToChatOptions();
    }, 2000);
}

// Add floating button to chat interface
function addFloatingButton() {
    // Check if button already exists
    if ($('#character_impersonation_float_btn').length > 0) {
        return;
    }
    
    const character = getCurrentCharacterInfo();
    if (!character || !extensionSettings.enabled) {
        return;
    }
    
    const floatingButton = $(`
        <div id="character_impersonation_float_btn" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            background: var(--SmartThemeBlurTintColor, #444);
            border: 2px solid var(--SmartThemeBorderColor, #666);
            border-radius: 50px;
            padding: 10px 15px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            color: var(--SmartThemeColor, #fff);
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 8px;
        ">
            <i class="fa fa-theater-masks"></i>
            <span>Roleplay</span>
        </div>
    `);
    
    // Add hover effect
    floatingButton.hover(
        function() {
            $(this).css({
                'transform': 'scale(1.05)',
                'background': 'var(--SmartThemeEmColor, #4a9eff)'
            });
        },
        function() {
            $(this).css({
                'transform': 'scale(1)',
                'background': 'var(--SmartThemeBlurTintColor, #444)'
            });
        }
    );
    
    // Add click handler
    floatingButton.on('click', showImpersonationModal);
    
    $('body').append(floatingButton);
}

// Remove floating button if needed
function removeFloatingButton() {
    $('#character_impersonation_float_btn').remove();
}

// Update UI elements when character changes
function updateUIElements() {
    // Remove existing elements
    $('.character_impersonation_option').remove();
    $('.character_impersonation_chat_option').remove();
    removeFloatingButton();
    
    // Re-add if extension is enabled
    if (extensionSettings.enabled) {
        addFloatingButton();
        addToMessageOptionsMenu();
    }
}
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
        console.log('[Character Impersonation] Registering slash commands...');
        
        // Main impersonation command - changed to /roleplay since /impersonate exists
        registerSlashCommand('roleplay', async (args, value) => {
            if (!extensionSettings.enabled) {
                return "Character Impersonation extension is disabled. Enable it in the extension settings.";
            }
            
            try {
                // Parse arguments - simple approach
                let customPrompt = null;
                let input = value || '';
                
                // Check for prompt= parameter
                if (args && typeof args === 'object' && args.prompt) {
                    customPrompt = args.prompt;
                }
                
                const response = await impersonateCharacter(input, customPrompt);
                return `Roleplay complete. Response generated as ${getCurrentCharacterInfo()?.name || 'character'}.`;
            } catch (error) {
                console.error('[Character Impersonation] Error:', error);
                return `Error: ${error.message}`;
            }
        }, ['rp'], '<span class="monospace">prompt=(custom system prompt)</span> (message) – Generate a response as your current character', true, true);
        
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
        return true;
    } else {
        console.warn('[Character Impersonation] registerSlashCommand not available, commands not registered');
        return false;
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
            const commandsRegistered = registerSlashCommands();
            if (commandsRegistered) {
                console.log('[Character Impersonation] Slash commands registered successfully');
            }
        } catch (commandError) {
            console.error('[Character Impersonation] Failed to register slash commands:', commandError);
        }
        
        // Make functions globally available for UI interaction
        window.showImpersonationModal = showImpersonationModal;
        window.updateUIElements = updateUIElements;
        window.testCharacterImpersonation = testCharacterImpersonation;
        console.log('[Character Impersonation] Functions made globally available');
        
        // Initialize UI integrations
        if (diagnostics.jQuery) {
            console.log('[Character Impersonation] jQuery available, setting up UI integrations...');
            
            // Set up UI elements after a short delay
            setTimeout(() => {
                updateUIElements();
                console.log('[Character Impersonation] UI elements initialized');
            }, 1000);
            
            // Initialize settings UI when ready
            setTimeout(() => {
                initSettingsUI();
            }, 500);
            
            // Use multiple methods to ensure UI initialization
            $(document).ready(() => {
                console.log('[Character Impersonation] Document ready, attempting UI init...');
                setTimeout(() => {
                    initSettingsUI();
                    updateUIElements();
                }, 1000);
            });
            
            // Listen for character changes
            $(document).on('character_selected', () => {
                console.log('[Character Impersonation] Character selected, updating UI...');
                setTimeout(() => {
                    updateUIElements();
                }, 500);
            });
            
            // Listen for chat changes
            $(document).on('chatLoaded', () => {
                console.log('[Character Impersonation] Chat loaded, updating UI...');
                setTimeout(() => {
                    updateUIElements();
                }, 500);
            });
            
            // Also try when extensions are loaded
            $(document).on('extensionsReady extensionsLoaded', () => {
                console.log('[Character Impersonation] Extensions ready/loaded event, updating UI...');
                setTimeout(() => {
                    initSettingsUI();
                    updateUIElements();
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
        console.log('[Character Impersonation] Available commands: /roleplay, /rp, /setimprompt, /setprompt');
        console.log('[Character Impersonation] UI: Floating button and modal dialog available');
        
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
        
        // Test slash command availability
        console.log('Testing slash commands...');
        if (typeof registerSlashCommand === 'function') {
            console.log('✓ registerSlashCommand is available');
        } else {
            console.log('✗ registerSlashCommand is NOT available');
        }
        
        // Test modal function
        console.log('Testing modal function...');
        if (typeof window.showImpersonationModal === 'function') {
            console.log('✓ showImpersonationModal is globally available');
        } else {
            console.log('✗ showImpersonationModal is NOT globally available');
        }
        
        // Test UI elements
        console.log('Testing UI elements...');
        const floatingBtn = $('#character_impersonation_float_btn');
        console.log('Floating button found:', floatingBtn.length > 0);
        
        const settingsPanel = $('.character-impersonation-settings');
        console.log('Settings panel found:', settingsPanel.length > 0);
        
        console.log('[Character Impersonation] Test completed successfully');
        
        // Provide quick commands for testing
        console.log('\n--- Quick Test Commands ---');
        console.log('Test modal: showImpersonationModal()');
        console.log('Test slash command: Type "/roleplay Hello there!" in chat');
        console.log('Update UI: updateUIElements()');
        
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