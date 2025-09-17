import { exec } from 'child_process';

export interface DeployProjectParams {
  projectDir: string;
  targetOrg: string;
  concise?: boolean;
}

/**
 * Deploys a project to a Salesforce org.
 */
export async function deployProjectToOrg({
  projectDir,
  targetOrg,
  concise = true
}: DeployProjectParams): Promise<{ success: boolean; output: string }> {
  const conciseFlag = concise ? '--concise' : '';
  const cmd = `sf project deploy start --source-dir force-app --target-org ${targetOrg} ${conciseFlag}`.trim();

  // Save current directory
  const originalCwd = process.cwd();
  
  try {
    // Change to project directory
    process.chdir(projectDir);

    return new Promise((resolve) => {
      exec(cmd, (error, stdout, stderr) => {
        // Always restore original directory
        process.chdir(originalCwd);
        
        if (error) {
          resolve({ success: false, output: 'Deployment failed' });
        } else {
          resolve({ success: true, output: stdout });
        }
      });
    });
  } catch (error: any) {
    // Restore directory if chdir failed
    process.chdir(originalCwd);
    return { success: false, output: 'Failed to change directory' };
  }
} 