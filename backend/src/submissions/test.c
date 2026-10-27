#include <stdio.h>

int main() {
    int n = 0;
    long long fact = 1; 
    scanf("%d", &n);
    
    if (n == 0) {
        printf("1\n");
    } else {
        for(int i = n; i >= 1; i--) {
            fact = fact * i;
        }
        printf("%lld\n", fact);
    }
    
    return 0;
}