PREFIX=f5-appsvcs
TMPDIR=source-package
VERSION=$(node -e "console.log(require('./package.json').version)")

mkdir -p $TMPDIR/$PREFIX
git archive HEAD --prefix=source-raw/ -o $TMPDIR/$PREFIX.tar.gz

cd $TMPDIR
tar -xf $PREFIX.tar.gz
cp -r source-raw/src/ $PREFIX/src
mkdir -p $PREFIX/scripts
cp source-raw/scripts/build/*buildRpm.sh $PREFIX/scripts
cp source-raw/scripts/build/schema-build.js $PREFIX/scripts/
cp source-raw/scripts/build/schema-check.js $PREFIX/scripts/
cp source-raw/scripts/build/per-app-schema-check.js $PREFIX/scripts/
cp source-raw/scripts/dev/install-rpm.sh $PREFIX/scripts/
cp source-raw/package.json $PREFIX/
cp source-raw/package-lock.json $PREFIX/
cp source-raw/f5-appsvcs.spec $PREFIX/
cp source-raw/.npmrc $PREFIX/
mkdir -p $PREFIX/dist
npm ci --prefix ./$PREFIX
tar -czf ../dist/f5-appsvcs-$VERSION-source.tar.gz $PREFIX
cd -
rm -r $TMPDIR

tar -czf dist/f5-appsvcs-$VERSION-examples.tar.gz examples
