const fs = require('fs');
const path = require('path');
const Datastore = require('nedb');

// Plugin info
const info = {
    id: 'sillytavern-character-manager',
    name: 'SillyTavern Character Manager',
    description: 'A plugin for managing character tags and categories with admin control'
};

// Database instances
let tagsDb;
let categoriesDb;
let characterTagsDb;
let characterCategoriesDb;

// Data directory path
const dataDir = path.join(process.cwd(), 'data', 'sillytavern-character-manager');

/**
 * Initialize the plugin
 * @param {import('express').Router} router Express router
 * @returns {Promise<void>}
 */
async function init(router) {
    console.log('Initializing SillyTavern Character Manager plugin...');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize databases
    tagsDb = new Datastore({ filename: path.join(dataDir, 'tags.db'), autoload: true });
    categoriesDb = new Datastore({ filename: path.join(dataDir, 'categories.db'), autoload: true });
    characterTagsDb = new Datastore({ filename: path.join(dataDir, 'character_tags.db'), autoload: true });
    characterCategoriesDb = new Datastore({ filename: path.join(dataDir, 'character_categories.db'), autoload: true });
    
    // Create indexes for better performance
    characterTagsDb.ensureIndex({ fieldName: 'characterId' });
    characterTagsDb.ensureIndex({ fieldName: 'tagId' });
    characterCategoriesDb.ensureIndex({ fieldName: 'characterId' });
    characterCategoriesDb.ensureIndex({ fieldName: 'categoryId' });
    
    // Middleware to check admin access
    const requireAdmin = (req, res, next) => {
        // In SillyTavern, the user is typically stored in req.user or similar
        // For now, we'll check if the user is 'default-user' or if no user system is enabled
        const user = req.user || { handle: 'default-user' };
        
        if (user.handle !== 'default-user') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        
        next();
    };
    
    // Tag management endpoints
    
    // Get all tags
    router.get('/tags', (req, res) => {
        tagsDb.find({}, (err, tags) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve tags' });
            }
            res.json(tags);
        });
    });
    
    // Create a new tag
    router.post('/tags', requireAdmin, (req, res) => {
        const { name, color } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Tag name is required' });
        }
        
        const tag = {
            name: name.trim(),
            color: color || '#007bff',
            createdAt: new Date()
        };
        
        // Check if tag already exists
        tagsDb.findOne({ name: tag.name }, (err, existingTag) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingTag) {
                return res.status(409).json({ error: 'Tag already exists' });
            }
            
            tagsDb.insert(tag, (err, newTag) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create tag' });
                }
                res.status(201).json(newTag);
            });
        });
    });
    
    // Delete a tag
    router.delete('/tags/:tagId', requireAdmin, (req, res) => {
        const tagId = req.params.tagId;
        
        // Remove tag from all characters first
        characterTagsDb.remove({ tagId: tagId }, { multi: true }, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to remove tag associations' });
            }
            
            // Then remove the tag itself
            tagsDb.remove({ _id: tagId }, {}, (err, numRemoved) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to delete tag' });
                }
                
                if (numRemoved === 0) {
                    return res.status(404).json({ error: 'Tag not found' });
                }
                
                res.json({ message: 'Tag deleted successfully' });
            });
        });
    });
    
    // Category management endpoints
    
    // Get all categories
    router.get('/categories', (req, res) => {
        categoriesDb.find({}, (err, categories) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve categories' });
            }
            res.json(categories);
        });
    });
    
    // Create a new category
    router.post('/categories', requireAdmin, (req, res) => {
        const { name, description, color } = req.body;
        
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return res.status(400).json({ error: 'Category name is required' });
        }
        
        const category = {
            name: name.trim(),
            description: description || '',
            color: color || '#28a745',
            createdAt: new Date()
        };
        
        // Check if category already exists
        categoriesDb.findOne({ name: category.name }, (err, existingCategory) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingCategory) {
                return res.status(409).json({ error: 'Category already exists' });
            }
            
            categoriesDb.insert(category, (err, newCategory) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to create category' });
                }
                res.status(201).json(newCategory);
            });
        });
    });
    
    // Delete a category
    router.delete('/categories/:categoryId', requireAdmin, (req, res) => {
        const categoryId = req.params.categoryId;
        
        // Remove category from all characters first
        characterCategoriesDb.remove({ categoryId: categoryId }, { multi: true }, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to remove category associations' });
            }
            
            // Then remove the category itself
            categoriesDb.remove({ _id: categoryId }, {}, (err, numRemoved) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to delete category' });
                }
                
                if (numRemoved === 0) {
                    return res.status(404).json({ error: 'Category not found' });
                }
                
                res.json({ message: 'Category deleted successfully' });
            });
        });
    });
    
    // Character-Tag association endpoints
    
    // Get tags for a character
    router.get('/characters/:characterId/tags', (req, res) => {
        const characterId = req.params.characterId;
        
        characterTagsDb.find({ characterId: characterId }, (err, associations) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve character tags' });
            }
            
            const tagIds = associations.map(assoc => assoc.tagId);
            
            if (tagIds.length === 0) {
                return res.json([]);
            }
            
            tagsDb.find({ _id: { $in: tagIds } }, (err, tags) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve tag details' });
                }
                res.json(tags);
            });
        });
    });
    
    // Assign tags to a character
    router.post('/characters/:characterId/tags', requireAdmin, (req, res) => {
        const characterId = req.params.characterId;
        const { tagIds } = req.body;
        
        if (!Array.isArray(tagIds)) {
            return res.status(400).json({ error: 'tagIds must be an array' });
        }
        
        // Remove existing associations for this character
        characterTagsDb.remove({ characterId: characterId }, { multi: true }, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to clear existing tags' });
            }
            
            if (tagIds.length === 0) {
                return res.json({ message: 'Character tags cleared' });
            }
            
            // Create new associations
            const associations = tagIds.map(tagId => ({
                characterId: characterId,
                tagId: tagId,
                createdAt: new Date()
            }));
            
            characterTagsDb.insert(associations, (err, newAssociations) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to assign tags' });
                }
                res.json({ message: 'Tags assigned successfully', associations: newAssociations });
            });
        });
    });
    
    // Character-Category association endpoints
    
    // Get categories for a character
    router.get('/characters/:characterId/categories', (req, res) => {
        const characterId = req.params.characterId;
        
        characterCategoriesDb.find({ characterId: characterId }, (err, associations) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve character categories' });
            }
            
            const categoryIds = associations.map(assoc => assoc.categoryId);
            
            if (categoryIds.length === 0) {
                return res.json([]);
            }
            
            categoriesDb.find({ _id: { $in: categoryIds } }, (err, categories) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve category details' });
                }
                res.json(categories);
            });
        });
    });
    
    // Assign categories to a character
    router.post('/characters/:characterId/categories', requireAdmin, (req, res) => {
        const characterId = req.params.characterId;
        const { categoryIds } = req.body;
        
        if (!Array.isArray(categoryIds)) {
            return res.status(400).json({ error: 'categoryIds must be an array' });
        }
        
        // Remove existing associations for this character
        characterCategoriesDb.remove({ characterId: characterId }, { multi: true }, (err) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to clear existing categories' });
            }
            
            if (categoryIds.length === 0) {
                return res.json({ message: 'Character categories cleared' });
            }
            
            // Create new associations
            const associations = categoryIds.map(categoryId => ({
                characterId: characterId,
                categoryId: categoryId,
                createdAt: new Date()
            }));
            
            characterCategoriesDb.insert(associations, (err, newAssociations) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to assign categories' });
                }
                res.json({ message: 'Categories assigned successfully', associations: newAssociations });
            });
        });
    });
    
    // Get all character associations (for bulk operations)
    router.get('/characters/associations', (req, res) => {
        const result = {};
        
        // Get all character-tag associations
        characterTagsDb.find({}, (err, tagAssociations) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to retrieve tag associations' });
            }
            
            // Get all character-category associations
            characterCategoriesDb.find({}, (err, categoryAssociations) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to retrieve category associations' });
                }
                
                // Group by character ID
                tagAssociations.forEach(assoc => {
                    if (!result[assoc.characterId]) {
                        result[assoc.characterId] = { tags: [], categories: [] };
                    }
                    result[assoc.characterId].tags.push(assoc.tagId);
                });
                
                categoryAssociations.forEach(assoc => {
                    if (!result[assoc.characterId]) {
                        result[assoc.characterId] = { tags: [], categories: [] };
                    }
                    result[assoc.characterId].categories.push(assoc.categoryId);
                });
                
                res.json(result);
            });
        });
    });
    
    console.log('SillyTavern Character Manager plugin initialized successfully!');
    return Promise.resolve();
}

/**
 * Clean up plugin resources
 * @returns {Promise<void>}
 */
async function exit() {
    console.log('SillyTavern Character Manager plugin shutting down...');
    return Promise.resolve();
}

module.exports = {
    init,
    exit,
    info
};

