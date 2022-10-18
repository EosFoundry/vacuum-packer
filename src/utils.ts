export const strfy = (o:any) => JSON.stringify(o, null, 2);
export const Msg = (n:string) => {
  const name = n;
  return (loggable:string|any) => {
    process.stdout.write(`${name} ==> `);
    if (typeof loggable !== 'string') {
      console.dir(loggable);
    } else {
      console.log(loggable);
    }
  }
};
