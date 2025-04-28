import { exec } from 'child_process';
import util from 'util';
import os from 'os';
import fs from 'fs';

// const execPromise = util.promisify(exec);
const execPromise = util.promisify(exec);

export const runCommand = async (
  command: string,
  workingDir: string,
): Promise<string> => {
  try {
    const { stdout, stderr } = await execPromise(command, { cwd: workingDir });
    if (stderr) {
      console.error(`stderr: ${stderr}`);
    }
    return stdout;
  } catch (error: any) {
    console.error(`Error executing command: ${error.message}`);
    throw error;
  }
};

// define os
const isWindows = os.platform() === 'win32';
export const gradlewExecutable = isWindows ? 'gradlew.bat' : 'gradlew';

//remove temp stored files
export const removeTempStoredFile = (
  replayPath: string,
  tempReplayPath: string,
) => {
  fs.unlink(replayPath, (err) => {
    if (err) {
      console.error(
        `Failed to delete the replay from ${replayPath} - ${err?.message}`,
      );
    } else {
      console.log('Replay successfully deleted');
    }
  });
  // del the temp copy of the uploaded replay
  fs.unlink(tempReplayPath, (err) => {
    if (err) {
      console.error(
        `Failed to delete the temp replay from ${tempReplayPath} - ${err.message}`,
      );
    } else {
      console.log('Temp replay successfully deleted');
    }
  });
};
