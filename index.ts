import { exec, spawn } from "child_process";
import {convertToKebabCase} from "./utils";

type ThorRunnerRunOptions = {
	targetLocation: string,
	permissions?: Record<string, string>,
	params?: string[],
	onOutput?: (data:string, isStdErr?:boolean) => void,
	onExit?: (exitCode:number) => void
}

export default class ThorRunner {

	static async isReady(){
		return new Promise((resolve) => {
			exec('which deno', (error, stdout, stderr) => {
				if (!!error) return resolve(false);
				return resolve(!stdout.includes('not found'));
			});
		})
	}

	static run(options:ThorRunnerRunOptions){
		let permissions = Object.entries(options.permissions ?? {})
			.map(entry => `--${convertToKebabCase(entry[0])}=${entry[1]}`)
		let child = spawn(`deno run ${permissions} ${options.targetLocation} ${(options.params ?? []).join(' ')}`);

		child.stdout.on('data', data => {
			options.onOutput?.(data, false);
		});

		child.stderr.on('data', data => {
			options.onOutput?.(data, true);
		});

		child.on('close', (code) => {
			options.onExit?.(code);
		});

		return { kill: (code?:number) => child.kill(code) }
	}

}