import { AppShell, Container, Group, Text } from '@mantine/core';
import { ColorSchemeToggle } from './ColorSchemeToggle';
import { HomePage } from './HomePage';

export function App() {
  return (
    <AppShell header={{ height: 60 }}>
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group h="100%" justify="space-between">
            <Text fw={700} size="lg">
              Календарь звонков
            </Text>
            <ColorSchemeToggle />
          </Group>
        </Container>
      </AppShell.Header>
      <AppShell.Main>
        <HomePage />
      </AppShell.Main>
    </AppShell>
  );
}
