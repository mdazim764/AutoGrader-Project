#include <stdio.h>

int main() {
    int n=0;
    scanf("%d", &n);
int fact=1;
for(int i=n;i>=1;i--){
fact=fact*i;
}
    printf("%d\n",fact);
    return 0;
}