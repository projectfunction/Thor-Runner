

export function convertToKebabCase(input:string){
	return input.replace(/[a-z][A-Z]/g, (a,b,c)=> a[0] + '-' + a.substring(1).toLowerCase() );
}