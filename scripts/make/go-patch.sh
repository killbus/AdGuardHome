#!/bin/sh

# Exit the script if a pipeline fails (-e), prevent accidental filename
# expansion (-f), and consider undefined variables as errors (-u).
set -e -f -u

patches_dir="patches"
prev_pkg=""
for patch in $(find $patches_dir -name "*.patch"); do
    # We extract package name from patch file path like this:
    pkg=$(echo $patch | sed "s|$patches_dir/\(.*\)/[^/]*$|\1|g")
    # pkg_path=$(echo $pkg | sed -r 's/([A-Z])/!\L\1/g')  # GNU sed required
    pkg_path=$(echo $pkg | \
        awk 'BEGIN{
        FS=OFS="/"
    } {
        for (i=2; i<=NF; i++) {
            new_field="";
            for (j=1;j<=length($i);j++) {
                char=substr($i,j,1); 
                if (char ~ /[A-Z]/) {
                    char="!"tolower(char)
                };
                new_field=new_field char;
            };
            $i=new_field
        }
    } 1')
    # Check whether the package has changed
    # if [ "$pkg" != "$prev_pkg" ] && [ "$prev_pkg" != "" ]; then
    #     # Do the replace if the package has changed
    #     go mod edit -replace=$prev_pkg@$version=$path
    # fi
    # Get the version and apply the patch
    version=$(go list -m -f '{{.Version}}' $pkg)
    path=$GOPATH/pkg/mod/$pkg_path@$version
    chmod -R u+w $path
    patch -d $path -p1 < $patch
    # Update prev_pkg
    prev_pkg=$pkg
    prev_path=$pkg_path
done
# Replace the last package
# go mod edit -replace=$prev_pkg@$version=$prev_path

echo "Patch applied successfully!"
