import type { ToolDefinition } from './tool.types';
import { searchDocsTool } from './search-docs.tool';
import { listWorkflowsTool, getWorkflowTool, createWorkflowTool } from './workflow-tools';
import { getDeliveryStatsTool, listDlqTool } from './analytics-tools';

export const ALL_TOOLS: ToolDefinition[] = [
  searchDocsTool,
  listWorkflowsTool,
  getWorkflowTool,
  createWorkflowTool,
  getDeliveryStatsTool,
  listDlqTool,
];

export function getToolByName(name: string): ToolDefinition | null {
  return ALL_TOOLS.find((t) => t.name === name) ?? null;
}

export function toGroqTools(tools: ToolDefinition[]) {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}