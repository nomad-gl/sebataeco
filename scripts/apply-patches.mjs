import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Apply wouter patch - adds route collection to Switch component
const wouterEsmPath = resolve(projectRoot, 'node_modules/wouter/esm/index.js');

if (existsSync(wouterEsmPath)) {
  let content = readFileSync(wouterEsmPath, 'utf8');
  
  // Only apply if not already patched
  if (!content.includes('__WOUTER_ROUTES__')) {
    const marker = 'const Switch = ({ children, location }) => {';
    const insertAfter = 'const [originalLocation] = useLocationFromRouter(router);';
    
    const patchCode = `

  // Collect all route paths to window object
  if (typeof window !== 'undefined') {
    if (!window.__WOUTER_ROUTES__) {
      window.__WOUTER_ROUTES__ = [];
    }

    const allChildren = flattenChildren(children);
    allChildren.forEach((element) => {
      if (isValidElement(element) && element.props.path) {
        const path = element.props.path;
        if (!window.__WOUTER_ROUTES__.includes(path)) {
          window.__WOUTER_ROUTES__.push(path);
        }
      }
    });
  }`;

    if (content.includes(insertAfter)) {
      content = content.replace(insertAfter, insertAfter + patchCode);
      writeFileSync(wouterEsmPath, content);
      console.log('[apply-patches] wouter patch applied successfully');
    } else {
      console.log('[apply-patches] wouter: could not find insertion point, skipping');
    }
  } else {
    console.log('[apply-patches] wouter already patched, skipping');
  }
} else {
  console.log('[apply-patches] wouter/esm/index.js not found, skipping');
}
