import {
  parseLockFile,
  writeLockFile,
} from '../packages/nx/src/utils/lock-file';

const pm = 'yarn';

parseLockFile(pm).then((value) => {
  // console.log(value);
  console.log(Object.keys(value));
  // // console.log(value['importers']);
  // console.log(value['lockfileVersion']);
  // console.log(value['overrides']);
  // console.log(value['packages']['/log4js/4.5.1']);
  // console.log(value['importers']);

  writeLockFile(value, pm).then(() => {
    console.log('done');
  });
});
