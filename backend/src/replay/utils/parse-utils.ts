import { exec } from 'child_process';
import * as path from 'path';
import { promises as fs } from 'fs';
import { promisify } from 'util';
import * as os from 'os';
import { ParsedRawInfo, ParsedRawMatchend } from 'src/types/parsedRawDataTypes';

const execAsync = promisify(exec);

// Absolute path to the directory containing gradlew.bat
const gradlewBatPath = path.resolve(process.cwd(), 'parser/clarity-examples');

// run gradlew on win or linux
const isWindows = os.platform() === 'win32';
const gradlewExecutable = isWindows ? 'gradlew.bat' : 'gradlew';

// Helper function to filter out unwanted text and extract JSON data
function extractJsonOutput(output: string): string | null {
  // Regular expression to extract JSON from the Gradle output
  const jsonMatch = output.match(/(\{.*\}|\[.*\])/s); // Matches the first JSON object or array, accounting for potential nested structures

  if (jsonMatch) {
    return jsonMatch[0]; // Return the matched JSON string
  }
  return null;
}

export async function parseMatchInfo(filePath: string) {
  try {
    const absoluteFilePath = path.resolve(process.cwd(), filePath);
    console.log('Processing file:', absoluteFilePath);

    // verify if file exists
    await fs.access(absoluteFilePath);

    const command = `${gradlewExecutable} infoRun --args "\\"${absoluteFilePath}\\""`; // Command for Gradle run

    console.log('Executing:', command);

    const { stdout, stderr } = await execAsync(command, {
      cwd: gradlewBatPath,
      windowsHide: true,
    });

    if (stderr) {
      console.error('Gradle stderr:', stderr);
      throw new Error(stderr);
    }

    // Extract only JSON output from stdout
    const jsonString = extractJsonOutput(stdout);
    if (jsonString) {
      const jsonData: ParsedRawInfo = JSON.parse(jsonString) as ParsedRawInfo;
      console.log('Parsed Match Info:', jsonData);
      return jsonData;
    } else {
      throw new Error('Failed to extract JSON from Gradle output.');
    }
  } catch (error) {
    console.error('Gradle execution failed:', error);
    throw new Error(`Failed to parse match info: ${error.message}`);
  }
}

export async function parseMatchEnd(filePath: string) {
  try {
    const absoluteFilePath = path.resolve(process.cwd(), filePath);
    const command = `${gradlewExecutable} matchendRun --args "\\"${absoluteFilePath}\\""`; // Command for Gradle run

    const { stdout, stderr } = await execAsync(command, {
      cwd: gradlewBatPath,
      windowsHide: true,
    });

    if (stderr) {
      console.error('Gradle stderr:', stderr);
      throw new Error(stderr);
    }

    // Extract only JSON output from stdout
    const jsonString = extractJsonOutput(stdout);
    if (jsonString) {
      const jsonData: ParsedRawMatchend[] = JSON.parse(
        jsonString,
      ) as ParsedRawMatchend[];
      console.log('Parsed Match End:', jsonData);
      return jsonData;
    } else {
      throw new Error('Failed to extract JSON from Gradle output.');
    }
  } catch (error) {
    console.error('Gradle execution failed:', error);
    throw new Error(`Failed to parse match end: ${error.message}`);
  }
}
