#!/usr/bin/env tsx
/**
 * Auto-generate standalone frontend types from database schema
 * Dynamically extracts types from schema.ts and individual-schema.ts
 * Run with: npm run types:generate
 */

import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'frontend-types.ts');

// Map Drizzle column types to TypeScript types
function mapDrizzleTypeToTS(drizzleType: string, enumMap?: Map<string, string>): string {
  if (drizzleType.startsWith('serial(')) return 'number';
  if (drizzleType.startsWith('integer(')) return 'number';
  if (drizzleType.startsWith('numeric(')) return 'string';
  if (drizzleType.startsWith('text(')) return 'string';
  if (drizzleType.startsWith('varchar(')) return 'string';
  if (drizzleType.startsWith('boolean(')) return 'boolean';
  if (drizzleType.startsWith('timestamp(')) return 'Date';
  if (drizzleType.startsWith('date(')) return 'string';
  if (drizzleType.startsWith('jsonb(')) return 'any';
  if (drizzleType.startsWith('json(')) return 'any';

  // Check if it's an enum reference (e.g., appSettingsTypeEnum)
  if (enumMap && drizzleType.match(/^(\w+Enum)\(/)) {
    const enumName = drizzleType.match(/^(\w+Enum)\(/)?.[1];
    if (enumName && enumMap.has(enumName)) {
      return enumMap.get(enumName)!;
    }
  }

  return 'any';
}

// Split by top-level commas (respecting nested structures)
function splitFields(fieldsBlock: string): string[] {
  const fields: string[] = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < fieldsBlock.length; i++) {
    const char = fieldsBlock[i];
    const prevChar = i > 0 ? fieldsBlock[i - 1] : '';

    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      // Track depth of nested structures
      if (char === '(' || char === '{' || char === '[') depth++;
      if (char === ')' || char === '}' || char === ']') depth--;

      // Split on top-level commas
      if (char === ',' && depth === 0) {
        if (current.trim()) fields.push(current.trim());
        current = '';
        continue;
      }
    }

    current += char;
  }

  if (current.trim()) fields.push(current.trim());
  return fields;
}

// Build enum map from content (enumName -> TypeName)
function buildEnumMap(content: string): Map<string, string> {
  const enumMap = new Map<string, string>();
  const enumMatches = content.matchAll(/export const (\w+Enum) = pgEnum\(/g);

  for (const match of enumMatches) {
    const enumName = match[1];
    // Convert appSettingsTypeEnum -> AppSettingsType
    let typeName = enumName.replace(/Enum$/, '');
    typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);
    enumMap.set(enumName, typeName);
  }

  return enumMap;
}

// Extract table definition and convert to TypeScript type
function extractTableType(content: string, tableName: string, enumMap?: Map<string, string>): string | null {
  // Find the pgTable definition start
  const tableStart = content.indexOf(`export const ${tableName} = pgTable(`);
  if (tableStart === -1) return null;

  // Find the opening brace of the fields object
  const fieldsStart = content.indexOf('{', tableStart +`export const ${tableName} = pgTable(`.length);
  if (fieldsStart === -1) return null;

  // Manually find the matching closing brace
  let depth = 1;
  let i = fieldsStart + 1;
  let inString = false;
  let stringChar = '';

  while (i < content.length && depth > 0) {
    const char = content[i];
    const prevChar = i > 0 ? content[i - 1] : '';

    // Handle strings
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (!inString) {
      if (char === '{') depth++;
      if (char === '}') depth--;
    }

    i++;
  }

  if (depth !== 0) return null;

  let fieldsBlock = content.substring(fieldsStart + 1, i - 1);

  // Remove comments from the fields block to avoid splitting issues
  fieldsBlock = fieldsBlock
    .split('\n')
    .map(line => {
      // Remove line comments but keep the field definition
      const commentIndex = line.indexOf('//');
      if (commentIndex !== -1) {
        return line.substring(0, commentIndex);
      }
      return line;
    })
    .join('\n');

  const fieldStrings = splitFields(fieldsBlock);

  let typeDefinition = '{\n';
  let fieldCount = 0;

  for (const fieldStr of fieldStrings) {
    // Skip empty strings
    if (!fieldStr.trim()) continue;

    // Match fieldName and type, then manually find modifiers
    const basicMatch = fieldStr.match(/^(\w+):\s*(\w+)\(/);
    if (!basicMatch) {
      continue;
    }

    const fieldName = basicMatch[1];
    const drizzleType = basicMatch[2];

    // Find the end of type(...) accounting for nested parentheses
    let depth = 1;
    let i = basicMatch[0].length; // Start after "fieldName: type("
    while (i < fieldStr.length && depth > 0) {
      if (fieldStr[i] === '(') depth++;
      if (fieldStr[i] === ')') depth--;
      i++;
    }

    // Everything after the closing ) of type(...) are modifiers
    const modifiers = fieldStr.substring(i).trim();

    fieldCount++;

    const tsType = mapDrizzleTypeToTS(drizzleType + '()', enumMap);

    // Fields are nullable by default unless .notNull() or .primaryKey() is present
    // serial().primaryKey() implies notNull
    const isNotNull = modifiers.includes('.notNull()') ||
                     modifiers.includes('.primaryKey()') ||
                     modifiers.includes('.default(') ||
                     drizzleType === 'serial';
    const nullableSuffix = isNotNull ? '' : ' | null';

    typeDefinition += `  ${fieldName}: ${tsType}${nullableSuffix};\n`;
  }

  if (fieldCount === 0) {
    return null;
  }

  typeDefinition += '}';
  return typeDefinition;
}

// Extract enum values from pgEnum definitions
function extractEnumTypes(content: string): string {
  let enumTypes = '';

  // Match pgEnum definitions: export const fooEnum = pgEnum("name", ["val1", "val2"]);
  const enumMatches = content.matchAll(/export const (\w+) = pgEnum\([^,]+,\s*\[([^\]]+)\]\);?/g);

  for (const match of enumMatches) {
    const enumName = match[1];
    const valuesStr = match[2];

    // Extract values from the array (handle both "value" and 'value')
    const values = valuesStr.match(/["']([^"']+)["']/g)?.map(v => v.slice(1, -1)) || [];

    if (values.length === 0) continue;

    // Convert enum name to type name (e.g., appSettingsTypeEnum -> AppSettingsType)
    // Remove 'Enum' suffix first, then convert to PascalCase
    let typeName = enumName.replace(/Enum$/, '');

    // Convert camelCase to PascalCase
    typeName = typeName.charAt(0).toUpperCase() + typeName.slice(1);

    // Generate union type
    const unionType = values.map(v => `'${v}'`).join(' | ');
    enumTypes += `export type ${typeName} = ${unionType};\n`;
  }

  return enumTypes;
}

// Extract types from schema file (base or individual)
function extractSchemaTypes(schemaPath: string): string {
  const fullPath = path.join(process.cwd(), schemaPath);

  if (!fs.existsSync(fullPath)) {
    return '';
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  let types = '';

  // Build enum map for this schema
  const enumMap = buildEnumMap(content);

  // First, extract all table names from pgTable definitions
  const tableMatches = content.matchAll(/export const (\w+) = pgTable\(/g);
  const tableNames = Array.from(tableMatches).map(m => m[1]);

  // Extract all exported type definitions
  const typeMatches = content.matchAll(/export type (\w+) = ([^;]+);/g);

  for (const match of typeMatches) {
    const typeName = match[1];
    let typeValue = match[2].trim();

    // Skip enum-related types that reference .enumValues - we'll extract those from pgEnum
    if (typeValue.includes('.enumValues')) {
      continue;
    }

    // Helper function to find matching table name
    const findMatchingTable = (typeName: string): string | undefined => {
      const lowerTypeName = typeName.toLowerCase();

      // Try exact match (lowercase)
      let match = tableNames.find(t => t.toLowerCase() === lowerTypeName);
      if (match) return match;

      // Try camelCase version (e.g., User -> user)
      const camelCaseVersion = typeName.charAt(0).toLowerCase() + typeName.slice(1);
      match = tableNames.find(t => t === camelCaseVersion);
      if (match) return match;

      // Try plural versions (e.g., User -> users, Role -> roles, Activity -> activities)
      const pluralVersions = [
        camelCaseVersion + 's',         // user -> users
        camelCaseVersion + 'es',        // watch -> watches
        camelCaseVersion.replace(/y$/, 'ies'), // activity -> activities
      ];

      for (const plural of pluralVersions) {
        match = tableNames.find(t => t === plural);
        if (match) return match;
      }

      return undefined;
    };

    // Replace Drizzle inferences with proper types
    if (typeValue.includes('$inferSelect') && !typeValue.includes('[')) {
      // This is a table type - try to extract from table definition
      const matchedTableName = findMatchingTable(typeName);

      if (matchedTableName) {
        const extractedType = extractTableType(content, matchedTableName, enumMap);
        if (extractedType) {
          types += `export type ${typeName} = ${extractedType};\n\n`;
          continue;
        }
      }

      // Fallback: add TODO comment
      types += `// TODO: Manually expand ${typeName} based on your table schema\n`;
      types += `// export type ${typeName} = {\n//   id: number;\n//   // Add your fields here\n// };\n\n`;
    } else if (typeValue.includes('$inferSelect[') || typeValue.includes('$inferInsert[')) {
      // This is an ID type
      types += `export type ${typeName} = number;\n\n`;
    } else if (typeValue.includes('$inferInsert') && !typeValue.includes('[')) {
      // This is an insert type (same as select for our purposes)
      const matchedTableName = findMatchingTable(typeName);

      if (matchedTableName) {
        const extractedType = extractTableType(content, matchedTableName, enumMap);
        if (extractedType) {
          types += `export type ${typeName} = ${extractedType};\n\n`;
          continue;
        }
      }
    } else {
      // Regular type - keep as is
      types += `export type ${typeName} = ${typeValue};\n\n`;
    }
  }

  return types;
}

// Extract enum from TypeScript enum definition (works for both export and non-export)
function extractTSEnum(content: string, enumName: string): string | null {
  // Match: (export)? (const)? enum EnumName { ... }
  const enumRegex = new RegExp(`(?:export\\s+)?(?:const\\s+)?enum\\s+${enumName}\\s*\\{([\\s\\S]+?)\\}`);
  const match = content.match(enumRegex);

  if (!match) return null;

  const enumBody = match[1];
  const entries: string[] = [];

  // Extract enum entries: Key = "value"
  const entryMatches = enumBody.matchAll(/(\w+)\s*=\s*["']([^"']+)["']/g);
  for (const entryMatch of entryMatches) {
    const key = entryMatch[1];
    const value = entryMatch[2];
    entries.push(`  ${key} = "${value}"`);
  }

  if (entries.length === 0) return null;

  return `export enum ${enumName} {\n${entries.join(',\n')}\n}`;
}

// Extract AppSettingsTypeMap from individual-settings.ts
function extractAppSettingsTypeMap(content: string): string | null {
  const typeMapRegex = /export type AppSettingsTypeMap\s*=\s*\{([\s\S]+?)\}/;
  const match = content.match(typeMapRegex);

  if (!match) return null;

  return `export type AppSettingsTypeMap = {${match[1]}};`;
}

// Generate the complete types file
function generateTypes(): string {
  console.log('📖 Reading schema files...');

  // Read base schema
  const baseSchemaPath = 'src/db/schema.ts';
  const baseSchemaContent = fs.readFileSync(path.join(process.cwd(), baseSchemaPath), 'utf-8');

  // Extract enums from base schema
  const enumTypes = extractEnumTypes(baseSchemaContent);

  // Extract base schema types
  const baseTypes = extractSchemaTypes(baseSchemaPath);

  // Extract individual schema types
  const individualTypes = extractSchemaTypes('src/db/individual/individual-schema.ts');

  // Extract permissions
  let permissionsEnum = '';
  const permissionServicePath = 'src/routes/auth/roles/permissions/permission.service.ts';
  if (fs.existsSync(path.join(process.cwd(), permissionServicePath))) {
    const permissionContent = fs.readFileSync(path.join(process.cwd(), permissionServicePath), 'utf-8');

    // Extract BaseAppPermissions enum
    const basePermEnum = extractTSEnum(permissionContent, 'BaseAppPermissions');

    // Extract IndividualAppPermissions from individual-permissions.ts
    const individualPermPath = 'src/routes/auth/roles/permissions/individual-permissions.ts';
    let individualPermEnum = '';
    if (fs.existsSync(path.join(process.cwd(), individualPermPath))) {
      const individualPermContent = fs.readFileSync(path.join(process.cwd(), individualPermPath), 'utf-8');
      individualPermEnum = extractTSEnum(individualPermContent, 'IndividualAppPermissions') || '';
    }

    // Merge enums
    if (basePermEnum) {
      // Extract entries from both enums and merge
      const baseEntries = basePermEnum.match(/(\w+\s*=\s*"[^"]+")(?:,|\n)/g) || [];
      const individualEntries = individualPermEnum ? (individualPermEnum.match(/(\w+\s*=\s*"[^"]+")(?:,|\n)/g) || []) : [];

      const allEntries = [
        ...baseEntries.map(e => e.replace(/,?\s*$/, '')),
        ...individualEntries.map(e => e.replace(/,?\s*$/, ''))
      ];

      if (allEntries.length > 0) {
        permissionsEnum = `export enum AppPermissions {\n  ${allEntries.join(',\n  ')}\n}\n\nexport type AppPermissionValue = (typeof AppPermissions)[keyof typeof AppPermissions];`;
      }
    }
  }

  // Extract settings
  let settingsEnum = '';
  let settingsTypeMap = '';
  const individualSettingsPath = 'src/routes/settings/individual-settings.ts';
  if (fs.existsSync(path.join(process.cwd(), individualSettingsPath))) {
    const settingsContent = fs.readFileSync(path.join(process.cwd(), individualSettingsPath), 'utf-8');

    const extracted = extractTSEnum(settingsContent, 'AppSettingsKey');
    if (extracted) {
      settingsEnum = extracted;
    }

    const typeMapExtracted = extractAppSettingsTypeMap(settingsContent);
    if (typeMapExtracted) {
      settingsTypeMap = typeMapExtracted;
    }
  }

  return `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Generated at: ${new Date().toISOString()}
// Run \`npm run types:generate\` to regenerate this file

// ============================================================================
// ENUMS & LITERAL TYPES
// ============================================================================

${enumTypes}
// ============================================================================
// DATABASE TYPES - Base Schema
// ============================================================================

${baseTypes}
// ============================================================================
// DATABASE TYPES - Individual Schema
// ============================================================================

${individualTypes}
// ============================================================================
// PERMISSIONS
// ============================================================================

${permissionsEnum || '// No permissions defined'}

// ============================================================================
// SETTINGS
// ============================================================================

${settingsEnum || '// No settings defined'}

${settingsTypeMap || ''}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type Languages = "DE" | "EN";

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
};

export type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
`;
}

try {
  console.log('🔧 Generating frontend types...');
  const content = generateTypes();

  fs.writeFileSync(OUTPUT_FILE, content, 'utf-8');

  console.log('✅ Frontend types generated successfully!');
  console.log(`📄 File: ${OUTPUT_FILE}`);
  console.log('');
  console.log('📋 Generated:');
  console.log('   ✓ Base schema types (User, Role, Permission, etc.)');
  console.log('   ✓ Individual schema types');
  console.log('   ✓ Enums & literal types');
  console.log('   ✓ Permissions & Settings');
  console.log('   ✓ API response types');
  console.log('');
  console.log('💡 To add individual types:');
  console.log('   1. Define tables in src/db/individual/individual-schema.ts');
  console.log('   2. Export types (e.g., export type Article = { ... })');
  console.log('   3. Run npm run types:generate');
} catch (error) {
  console.error('❌ Error generating frontend types:', error);
  process.exit(1);
}
