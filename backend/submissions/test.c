#include <stdio.h>
int main() {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\n", a + b);
    return 0;
}
// #include <stdio.h>

// int main() {
//     int a, b;
//     scanf("%d %d", &a, &b);
    
//     // Malicious Infinite Loop!
//     while(1) {
//         // Doing nothing, just burning CPU
//     }
    
//     printf("%d\n", a + b);
//     return 0;
// }