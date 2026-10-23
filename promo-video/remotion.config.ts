import {Config} from '@remotion/cli/config';
Config.setPublicDir('./assets');
Config.setBrowserExecutable(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe');
Config.setVideoImageFormat('jpeg');
Config.setColorSpace('bt709');
Config.setOverwriteOutput(true);
