import { exec, spawn } from "child_process";
import {nanoid} from "nanoid";
import * as fs from "fs/promises";
import {join} from "path";

type ThorRunnerRunOptions = {
	targetLocation: string,
	repoUrl: string,
	permissions?: Array<string>,
	params?: Array<string>,
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

	static async getDenoPath(){
		return new Promise<string>((resolve, reject) => {
			exec('which deno', (error, stdout, stderr) => {
				if (!!error) return reject(error);
				return resolve(stdout.trim());
			});
		});
	}

	static async exec(command:string, cwd:string){
		return new Promise<string>((resolve, reject) => {
			exec(command, {cwd}, (error, stdout, stderr) => {
				if (!!error) return reject(error);
				resolve(stdout);
			});
		});
	}

	static async run(options:ThorRunnerRunOptions){
		const instanceId = nanoid(12);
		const dirName = join(process.cwd(), instanceId);
		await fs.mkdir(dirName);

		let isRunning = true;

		options.onOutput?.(`Cloning ${options.repoUrl}`);
		await ThorRunner.exec(`git clone ${options.repoUrl}`, dirName).catch(e => console.error(e));
		options.onOutput?.('Cloned!');

		let permissions = [...options.permissions, `--allow-read=${dirName}`, '--allow-env=THOR_CWD'];

		options.onOutput?.(`Starting instance ${instanceId}...`);

		let child = spawn(
			await ThorRunner.getDenoPath().catch(()=>'deno'),
			['run', ...permissions, options.targetLocation, ...(options.params ?? [])],
			{ cwd: dirName, env: { ...process.env, 'THOR_CWD':dirName } }
		);

		child.stdout.on('data', data => {
			let lines = data.toString().split(/\r?\n/).filter(l => !!l && l.trim?.().length !== 0);
			lines.forEach(line => options.onOutput?.(line, false));
		});

		child.stderr.on('data', data => {
			let lines = data.toString().split(/\r?\n/).filter(l => !!l && l.trim?.().length !== 0);
			lines.forEach(line => options.onOutput?.(line, true));
		});

		child.on('close', (code) => {
			isRunning = false;
			options.onOutput?.(`Cleaning up instance ${instanceId}...`);
			fs.rm(dirName, { recursive: true }).finally(()=>{
				options.onOutput?.(`Done.`);
				options.onExit?.(code ?? 0);
			});
		});

		child.on('error', (err) => {
			options.onOutput?.(`[ERROR] ${err}`, true);
		})

		return {
			kill: (code?:number) => child.kill(code),
			path: dirName,
			instanceId: instanceId,
			checkIsRunning: ()=>isRunning
		}
	}

}