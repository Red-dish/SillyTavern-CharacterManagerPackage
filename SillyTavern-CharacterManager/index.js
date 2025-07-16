import { eventSource, event_types } from "../../../../script.js";

// Extension state
let tags = [];
let categories = [];
let characterAssociations = {};
let currentTab = 'tags';

// API base URL
const API_BASE = '/api/plugins/sillytavern-character-manager';

// Initialize the extension
jQuery(async () => {
    console.log('Character Manager extension loading...');
    
    // Add extension panel to the UI
    addExtensionPanel();
    
    // Load initial data
    await loadTags();
    await loadCategories();
    await loadCharacterAssociations();
    
    // Set up event listeners
    setupEventListeners();
    
    // Enhance character list
    enhanceCharacterList();
    
    console.log('Character Manager extension loaded successfully!');
});

// Add the extension panel to the UI
function addExtensionPanel() {
    const extensionsPanel = $('#extensions_settings');
    if (extensionsPanel.length === 0) {
        console.warn('Extensions panel not found, adding to main content');
        return;
    }
    
    const panelHtml = `
        <div id="character-manager-panel" class="character-manager-panel">
            <div class="character-manager-header">
                <div class="character-manager-title">Character Manager</div>
            </div>
            
            <div class="character-manager-tabs">
                <div class="character-manager-tab active" data-tab="tags">Tags</div>
                <div class="character-manager-tab" data-tab="categories">Categories</div>
                <div class="character-manager-tab" data-tab="assignments">Assignments</div>
            </div>
            
            <div class="character-manager-content">
                <!-- Tags tab -->
                <div id="tags-tab" class="character-manager-tab-content">
                    <div class="character-manager-form">
                        <input type="text" id="new-tag-name" class="character-manager-input" placeholder="Tag name">
                        <input type="color" id="new-tag-color" class="character-manager-color-input" value="#007bff">
                        <button id="add-tag-btn" class="character-manager-btn">Add Tag</button>
                    </div>
                    <div id="tags-list"></div>
                </div>
                
                <!-- Categories tab -->
                <div id="categories-tab" class="character-manager-tab-content character-manager-hidden">
                    <div class="character-manager-form">
                        <input type="text" id="new-category-name" class="character-manager-input" placeholder="Category name">
                        <input type="text" id="new-category-description" class="character-manager-input" placeholder="Description (optional)">
                        <input type="color" id="new-category-color" class="character-manager-color-input" value="#28a745">
                        <button id="add-category-btn" class="character-manager-btn">Add Category</button>
                    </div>
                    <div id="categories-list"></div>
                </div>
                
                <!-- Assignments tab -->
                <div id="assignments-tab" class="character-manager-tab-content character-manager-hidden">
                    <div class="character-filter-controls">
                        <select id="filter-by-tag" class="character-filter-select">
                            <option value="">Filter by tag...</option>
                        </select>
                        <select id="filter-by-category" class="character-filter-select">
                            <option value="">Filter by category...</option>
                        </select>
                        <button id="clear-filters-btn" class="character-manager-btn secondary">Clear Filters</button>
                    </div>
                    <button id="bulk-assign-btn" class="character-manager-btn">Bulk Assign</button>
                    <div id="character-assignments-list"></div>
                </div>
            </div>
        </div>
    `;
    
    extensionsPanel.append(panelHtml);
}

// Set up event listeners
function setupEventListeners() {
    // Tab switching
    $(document).on('click', '.character-manager-tab', function() {
        const tab = $(this).data('tab');
        switchTab(tab);
    });
    
    // Add tag
    $(document).on('click', '#add-tag-btn', async function() {
        const name = $('#new-tag-name').val().trim();
        const color = $('#new-tag-color').val();
        
        if (!name) {
            alert('Please enter a tag name');
            return;
        }
        
        await createTag(name, color);
        $('#new-tag-name').val('');
        $('#new-tag-color').val('#007bff');
    });
    
    // Add category
    $(document).on('click', '#add-category-btn', async function() {
        const name = $('#new-category-name').val().trim();
        const description = $('#new-category-description').val().trim();
        const color = $('#new-category-color').val();
        
        if (!name) {
            alert('Please enter a category name');
            return;
        }
        
        await createCategory(name, description, color);
        $('#new-category-name').val('');
        $('#new-category-description').val('');
        $('#new-category-color').val('#28a745');
    });
    
    // Delete tag
    $(document).on('click', '.delete-tag-btn', async function() {
        const tagId = $(this).data('tag-id');
        if (confirm('Are you sure you want to delete this tag?')) {
            await deleteTag(tagId);
        }
    });
    
    // Delete category
    $(document).on('click', '.delete-category-btn', async function() {
        const categoryId = $(this).data('category-id');
        if (confirm('Are you sure you want to delete this category?')) {
            await deleteCategory(categoryId);
        }
    });
    
    // Bulk assign
    $(document).on('click', '#bulk-assign-btn', function() {
        showBulkAssignModal();
    });
    
    // Clear filters
    $(document).on('click', '#clear-filters-btn', function() {
        $('#filter-by-tag').val('');
        $('#filter-by-category').val('');
        filterCharacterList();
    });
    
    // Filter changes
    $(document).on('change', '#filter-by-tag, #filter-by-category', function() {
        filterCharacterList();
    });
    
    // Listen for character list changes
    eventSource.on(event_types.CHARACTER_LOADED, enhanceCharacterList);
    eventSource.on(event_types.CHAT_CHANGED, enhanceCharacterList);
}

// Switch between tabs
function switchTab(tab) {
    currentTab = tab;
    
    // Update tab buttons
    $('.character-manager-tab').removeClass('active');
    $(`.character-manager-tab[data-tab="${tab}"]`).addClass('active');
    
    // Update tab content
    $('.character-manager-tab-content').addClass('character-manager-hidden');
    $(`#${tab}-tab`).removeClass('character-manager-hidden');
    
    // Refresh content based on tab
    if (tab === 'tags') {
        renderTagsList();
    } else if (tab === 'categories') {
        renderCategoriesList();
    } else if (tab === 'assignments') {
        renderAssignmentsList();
        updateFilterOptions();
    }
}

// API functions
async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        alert(`Error: ${error.message}`);
        throw error;
    }
}

async function loadTags() {
    try {
        tags = await apiRequest('/tags');
        renderTagsList();
    } catch (error) {
        console.error('Failed to load tags:', error);
    }
}

async function loadCategories() {
    try {
        categories = await apiRequest('/categories');
        renderCategoriesList();
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

async function loadCharacterAssociations() {
    try {
        characterAssociations = await apiRequest('/characters/associations');
        enhanceCharacterList();
    } catch (error) {
        console.error('Failed to load character associations:', error);
    }
}

async function createTag(name, color) {
    try {
        await apiRequest('/tags', {
            method: 'POST',
            body: JSON.stringify({ name, color })
        });
        await loadTags();
    } catch (error) {
        console.error('Failed to create tag:', error);
    }
}

async function createCategory(name, description, color) {
    try {
        await apiRequest('/categories', {
            method: 'POST',
            body: JSON.stringify({ name, description, color })
        });
        await loadCategories();
    } catch (error) {
        console.error('Failed to create category:', error);
    }
}

async function deleteTag(tagId) {
    try {
        await apiRequest(`/tags/${tagId}`, { method: 'DELETE' });
        await loadTags();
        await loadCharacterAssociations();
    } catch (error) {
        console.error('Failed to delete tag:', error);
    }
}

async function deleteCategory(categoryId) {
    try {
        await apiRequest(`/categories/${categoryId}`, { method: 'DELETE' });
        await loadCategories();
        await loadCharacterAssociations();
    } catch (error) {
        console.error('Failed to delete category:', error);
    }
}

async function assignTagsToCharacter(characterId, tagIds) {
    try {
        await apiRequest(`/characters/${characterId}/tags`, {
            method: 'POST',
            body: JSON.stringify({ tagIds })
        });
        await loadCharacterAssociations();
    } catch (error) {
        console.error('Failed to assign tags:', error);
    }
}

async function assignCategoriesToCharacter(characterId, categoryIds) {
    try {
        await apiRequest(`/characters/${characterId}/categories`, {
            method: 'POST',
            body: JSON.stringify({ categoryIds })
        });
        await loadCharacterAssociations();
    } catch (error) {
        console.error('Failed to assign categories:', error);
    }
}

// Render functions
function renderTagsList() {
    const container = $('#tags-list');
    container.empty();
    
    if (tags.length === 0) {
        container.append('<p>No tags created yet.</p>');
        return;
    }
    
    tags.forEach(tag => {
        const tagHtml = `
            <div class="tag-item">
                <div class="tag-info">
                    <div class="tag-color" style="background-color: ${tag.color}"></div>
                    <span class="tag-name">${tag.name}</span>
                </div>
                <div class="tag-actions">
                    <button class="character-manager-btn danger delete-tag-btn" data-tag-id="${tag._id}">Delete</button>
                </div>
            </div>
        `;
        container.append(tagHtml);
    });
}

function renderCategoriesList() {
    const container = $('#categories-list');
    container.empty();
    
    if (categories.length === 0) {
        container.append('<p>No categories created yet.</p>');
        return;
    }
    
    categories.forEach(category => {
        const categoryHtml = `
            <div class="category-item">
                <div class="category-info">
                    <div class="category-color" style="background-color: ${category.color}"></div>
                    <div>
                        <span class="category-name">${category.name}</span>
                        ${category.description ? `<div style="font-size: 12px; color: #666;">${category.description}</div>` : ''}
                    </div>
                </div>
                <div class="category-actions">
                    <button class="character-manager-btn danger delete-category-btn" data-category-id="${category._id}">Delete</button>
                </div>
            </div>
        `;
        container.append(categoryHtml);
    });
}

function renderAssignmentsList() {
    const container = $('#character-assignments-list');
    container.empty();
    
    const context = SillyTavern.getContext();
    const characters = context.characters || [];
    
    if (characters.length === 0) {
        container.append('<p>No characters found.</p>');
        return;
    }
    
    characters.forEach((character, index) => {
        const characterId = character.avatar || index.toString();
        const associations = characterAssociations[characterId] || { tags: [], categories: [] };
        
        const characterTags = associations.tags.map(tagId => {
            const tag = tags.find(t => t._id === tagId);
            return tag ? `<span class="character-tag" style="background-color: ${tag.color}">${tag.name}</span>` : '';
        }).join('');
        
        const characterCategories = associations.categories.map(categoryId => {
            const category = categories.find(c => c._id === categoryId);
            return category ? `<span class="character-category" style="background-color: ${category.color}">${category.name}</span>` : '';
        }).join('');
        
        const assignmentHtml = `
            <div class="character-assignment-item" data-character-id="${characterId}">
                <div class="character-assignment-name">
                    <strong>${character.name}</strong>
                    <div class="character-list-tags">${characterTags}</div>
                    <div class="character-list-categories">${characterCategories}</div>
                </div>
                <div class="character-assignment-actions">
                    <button class="character-manager-btn assign-tags-btn" data-character-id="${characterId}">Assign Tags</button>
                    <button class="character-manager-btn assign-categories-btn" data-character-id="${characterId}">Assign Categories</button>
                </div>
            </div>
        `;
        container.append(assignmentHtml);
    });
    
    // Add event listeners for assignment buttons
    $('.assign-tags-btn').off('click').on('click', function() {
        const characterId = $(this).data('character-id');
        showTagAssignmentModal(characterId);
    });
    
    $('.assign-categories-btn').off('click').on('click', function() {
        const characterId = $(this).data('character-id');
        showCategoryAssignmentModal(characterId);
    });
}

function updateFilterOptions() {
    const tagSelect = $('#filter-by-tag');
    const categorySelect = $('#filter-by-category');
    
    // Update tag options
    tagSelect.empty().append('<option value="">Filter by tag...</option>');
    tags.forEach(tag => {
        tagSelect.append(`<option value="${tag._id}">${tag.name}</option>`);
    });
    
    // Update category options
    categorySelect.empty().append('<option value="">Filter by category...</option>');
    categories.forEach(category => {
        categorySelect.append(`<option value="${category._id}">${category.name}</option>`);
    });
}

// Character list enhancement
function enhanceCharacterList() {
    // This function would enhance the main character list with tags and categories
    // Implementation depends on SillyTavern's character list structure
    setTimeout(() => {
        const characterElements = $('.character_select, .group_select');
        
        characterElements.each(function() {
            const element = $(this);
            const characterId = element.data('chid') || element.attr('chid');
            
            if (!characterId) return;
            
            const associations = characterAssociations[characterId] || { tags: [], categories: [] };
            
            // Remove existing tags/categories
            element.find('.character-list-tags, .character-list-categories').remove();
            
            // Add tags
            if (associations.tags.length > 0) {
                const characterTags = associations.tags.map(tagId => {
                    const tag = tags.find(t => t._id === tagId);
                    return tag ? `<span class="character-tag" style="background-color: ${tag.color}">${tag.name}</span>` : '';
                }).join('');
                
                element.append(`<div class="character-list-tags">${characterTags}</div>`);
            }
            
            // Add categories
            if (associations.categories.length > 0) {
                const characterCategories = associations.categories.map(categoryId => {
                    const category = categories.find(c => c._id === categoryId);
                    return category ? `<span class="character-category" style="background-color: ${category.color}">${category.name}</span>` : '';
                }).join('');
                
                element.append(`<div class="character-list-categories">${characterCategories}</div>`);
            }
        });
    }, 100);
}

function filterCharacterList() {
    const selectedTag = $('#filter-by-tag').val();
    const selectedCategory = $('#filter-by-category').val();
    
    $('.character_select, .group_select').each(function() {
        const element = $(this);
        const characterId = element.data('chid') || element.attr('chid');
        
        if (!characterId) return;
        
        const associations = characterAssociations[characterId] || { tags: [], categories: [] };
        
        let show = true;
        
        if (selectedTag && !associations.tags.includes(selectedTag)) {
            show = false;
        }
        
        if (selectedCategory && !associations.categories.includes(selectedCategory)) {
            show = false;
        }
        
        element.toggle(show);
    });
}

// Modal functions
function showTagAssignmentModal(characterId) {
    const context = SillyTavern.getContext();
    const character = context.characters.find(c => (c.avatar || context.characters.indexOf(c).toString()) === characterId);
    const associations = characterAssociations[characterId] || { tags: [], categories: [] };
    
    const modalHtml = `
        <div class="character-manager-modal">
            <div class="character-manager-modal-content">
                <div class="character-manager-modal-header">
                    <h3>Assign Tags to ${character ? character.name : 'Character'}</h3>
                    <button class="character-manager-modal-close">&times;</button>
                </div>
                <div class="character-assignment-list">
                    ${tags.map(tag => `
                        <div class="character-assignment-item">
                            <input type="checkbox" class="character-assignment-checkbox" value="${tag._id}" ${associations.tags.includes(tag._id) ? 'checked' : ''}>
                            <span class="character-assignment-name">
                                <span class="tag-color" style="background-color: ${tag.color}; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></span>
                                ${tag.name}
                            </span>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="character-manager-btn secondary modal-cancel">Cancel</button>
                    <button class="character-manager-btn modal-save" data-character-id="${characterId}">Save</button>
                </div>
            </div>
        </div>
    `;
    
    $('body').append(modalHtml);
    
    // Event listeners
    $('.character-manager-modal-close, .modal-cancel').on('click', function() {
        $('.character-manager-modal').remove();
    });
    
    $('.modal-save').on('click', async function() {
        const selectedTags = [];
        $('.character-assignment-checkbox:checked').each(function() {
            selectedTags.push($(this).val());
        });
        
        await assignTagsToCharacter(characterId, selectedTags);
        $('.character-manager-modal').remove();
        renderAssignmentsList();
    });
}

function showCategoryAssignmentModal(characterId) {
    const context = SillyTavern.getContext();
    const character = context.characters.find(c => (c.avatar || context.characters.indexOf(c).toString()) === characterId);
    const associations = characterAssociations[characterId] || { tags: [], categories: [] };
    
    const modalHtml = `
        <div class="character-manager-modal">
            <div class="character-manager-modal-content">
                <div class="character-manager-modal-header">
                    <h3>Assign Categories to ${character ? character.name : 'Character'}</h3>
                    <button class="character-manager-modal-close">&times;</button>
                </div>
                <div class="character-assignment-list">
                    ${categories.map(category => `
                        <div class="character-assignment-item">
                            <input type="checkbox" class="character-assignment-checkbox" value="${category._id}" ${associations.categories.includes(category._id) ? 'checked' : ''}>
                            <span class="character-assignment-name">
                                <span class="category-color" style="background-color: ${category.color}; width: 12px; height: 12px; display: inline-block; border-radius: 50%; margin-right: 5px;"></span>
                                ${category.name}
                            </span>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="character-manager-btn secondary modal-cancel">Cancel</button>
                    <button class="character-manager-btn modal-save" data-character-id="${characterId}">Save</button>
                </div>
            </div>
        </div>
    `;
    
    $('body').append(modalHtml);
    
    // Event listeners
    $('.character-manager-modal-close, .modal-cancel').on('click', function() {
        $('.character-manager-modal').remove();
    });
    
    $('.modal-save').on('click', async function() {
        const selectedCategories = [];
        $('.character-assignment-checkbox:checked').each(function() {
            selectedCategories.push($(this).val());
        });
        
        await assignCategoriesToCharacter(characterId, selectedCategories);
        $('.character-manager-modal').remove();
        renderAssignmentsList();
    });
}

function showBulkAssignModal() {
    // Implementation for bulk assignment modal
    alert('Bulk assignment feature coming soon!');
}

console.log('Character Manager extension script loaded');

